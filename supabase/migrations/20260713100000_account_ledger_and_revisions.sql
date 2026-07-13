-- Account-first ledger. Every new cash movement is posted through transactions and validated.
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.money_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public.receivables ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.money_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.money_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.money_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public.debt_payments ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.money_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public.receivable_payments ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.money_accounts(id) ON DELETE RESTRICT;

INSERT INTO public.money_accounts(user_id,name,account_type,initial_balance,currency,notes)
SELECT DISTINCT t.user_id,'Rekening Utama','bank',0,'IDR','Dibuat otomatis untuk migrasi transaksi lama'
FROM public.transactions t
WHERE NOT EXISTS (SELECT 1 FROM public.money_accounts a WHERE a.user_id=t.user_id AND a.deleted_at IS NULL);

UPDATE public.transactions t SET account_id=(SELECT a.id FROM public.money_accounts a WHERE a.user_id=t.user_id AND a.deleted_at IS NULL ORDER BY a.created_at LIMIT 1)
WHERE t.account_id IS NULL;

CREATE OR REPLACE FUNCTION public.account_balance(p_account_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_balance numeric; BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id <> auth.uid() THEN RAISE EXCEPTION 'Akses rekening ditolak'; END IF;
  SELECT COALESCE(a.initial_balance,0)+COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END),0) INTO v_balance
  FROM public.money_accounts a LEFT JOIN public.transactions t ON t.account_id=a.id AND t.deleted_at IS NULL
  WHERE a.id=p_account_id AND a.user_id=p_user_id AND a.deleted_at IS NULL GROUP BY a.initial_balance;
  RETURN COALESCE(v_balance,0);
END;
$$;
REVOKE ALL ON FUNCTION public.account_balance(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.account_balance(uuid,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.validate_account_transaction() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_balance numeric; BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.account_id IS NULL THEN RAISE EXCEPTION 'Rekening wajib dipilih'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.money_accounts WHERE id=NEW.account_id AND user_id=NEW.user_id AND deleted_at IS NULL AND is_active) THEN RAISE EXCEPTION 'Rekening tidak valid atau tidak aktif'; END IF;
  IF NEW.amount<=0 THEN RAISE EXCEPTION 'Nominal harus lebih dari nol'; END IF;
  IF NEW.type='expense' THEN
    v_balance:=public.account_balance(NEW.account_id,NEW.user_id);
    IF TG_OP='UPDATE' AND OLD.deleted_at IS NULL AND OLD.account_id=NEW.account_id AND OLD.type='expense' THEN v_balance:=v_balance+OLD.amount; END IF;
    IF NEW.amount>COALESCE(v_balance,0) THEN RAISE EXCEPTION 'Saldo rekening tidak mencukupi. Saldo tersedia: %',COALESCE(v_balance,0); END IF;
  END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_account_transaction ON public.transactions;
CREATE TRIGGER trg_validate_account_transaction BEFORE INSERT OR UPDATE OF account_id,amount,type,deleted_at ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.validate_account_transaction();

CREATE OR REPLACE FUNCTION public.post_related_account_transaction() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_type public.txn_type; v_amount numeric; v_account uuid; v_name text; v_key text; BEGIN
  IF TG_TABLE_NAME='debts' THEN v_type:='income';v_amount:=NEW.amount;v_account:=NEW.account_id;v_name:='Dana hutang dari '||NEW.lender_name;v_key:='debt_create:'||NEW.id;
  ELSIF TG_TABLE_NAME='receivables' THEN v_type:='expense';v_amount:=NEW.amount;v_account:=NEW.account_id;v_name:='Dana piutang untuk '||NEW.borrower_name;v_key:='receivable_create:'||NEW.id;
  ELSIF TG_TABLE_NAME='debt_payments' THEN v_type:='expense';v_amount:=NEW.amount;v_account:=NEW.account_id;v_name:='Pembayaran hutang';v_key:='debt_payment:'||NEW.id;
  ELSIF TG_TABLE_NAME='receivable_payments' THEN v_type:='income';v_amount:=NEW.amount;v_account:=NEW.account_id;v_name:='Penerimaan piutang';v_key:='receivable_payment:'||NEW.id;
  ELSIF TG_TABLE_NAME='investments' THEN v_type:='expense';v_amount:=NEW.quantity*NEW.avg_buy_price;v_account:=NEW.account_id;v_name:='Beli investasi '||NEW.name;v_key:='investment_buy:'||NEW.id;
  END IF;
  IF v_account IS NULL THEN RAISE EXCEPTION 'Rekening wajib dipilih'; END IF;
  INSERT INTO public.transactions(user_id,type,amount,date,account_id,name,note,tags)
  VALUES(NEW.user_id,v_type,v_amount,COALESCE(NEW.created_at::date,(now() AT TIME ZONE 'Asia/Jakarta')::date),v_account,v_name,v_key,ARRAY['system','linked']) ;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_debt_account_post ON public.debts; CREATE TRIGGER trg_debt_account_post AFTER INSERT ON public.debts FOR EACH ROW EXECUTE FUNCTION public.post_related_account_transaction();
DROP TRIGGER IF EXISTS trg_receivable_account_post ON public.receivables; CREATE TRIGGER trg_receivable_account_post AFTER INSERT ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.post_related_account_transaction();
DROP TRIGGER IF EXISTS trg_debt_payment_account_post ON public.debt_payments; CREATE TRIGGER trg_debt_payment_account_post AFTER INSERT ON public.debt_payments FOR EACH ROW EXECUTE FUNCTION public.post_related_account_transaction();
DROP TRIGGER IF EXISTS trg_receivable_payment_account_post ON public.receivable_payments; CREATE TRIGGER trg_receivable_payment_account_post AFTER INSERT ON public.receivable_payments FOR EACH ROW EXECUTE FUNCTION public.post_related_account_transaction();
DROP TRIGGER IF EXISTS trg_investment_account_post ON public.investments; CREATE TRIGGER trg_investment_account_post AFTER INSERT ON public.investments FOR EACH ROW EXECUTE FUNCTION public.post_related_account_transaction();

CREATE OR REPLACE FUNCTION public.pay_bill_from_account(p_bill_id uuid,p_account_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b record; BEGIN SELECT * INTO b FROM public.bills WHERE id=p_bill_id AND user_id=auth.uid() AND deleted_at IS NULL FOR UPDATE; IF b.id IS NULL THEN RAISE EXCEPTION 'Tagihan tidak ditemukan'; END IF; IF b.status='paid' THEN RAISE EXCEPTION 'Tagihan sudah lunas'; END IF;
INSERT INTO public.transactions(user_id,type,amount,date,account_id,name,note,tags) VALUES(auth.uid(),'expense',b.amount,(now() AT TIME ZONE 'Asia/Jakarta')::date,p_account_id,'Bayar tagihan '||b.name,'bill_payment:'||b.id,ARRAY['bill','system']); UPDATE public.bills SET status='paid',account_id=p_account_id WHERE id=b.id; END $$;
REVOKE ALL ON FUNCTION public.pay_bill_from_account(uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.pay_bill_from_account(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.pay_bill_from_account_service(p_bill_id uuid,p_account_id uuid,p_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b record; BEGIN SELECT * INTO b FROM public.bills WHERE id=p_bill_id AND user_id=p_user_id AND deleted_at IS NULL FOR UPDATE; IF b.id IS NULL THEN RAISE EXCEPTION 'Tagihan tidak ditemukan'; END IF; IF b.status='paid' THEN RAISE EXCEPTION 'Tagihan sudah lunas'; END IF;
INSERT INTO public.transactions(user_id,type,amount,date,account_id,name,note,tags) VALUES(p_user_id,'expense',b.amount,(now() AT TIME ZONE 'Asia/Jakarta')::date,p_account_id,'Bayar tagihan '||b.name,'bill_payment:'||b.id,ARRAY['bill','system']); UPDATE public.bills SET status='paid',account_id=p_account_id WHERE id=b.id; END $$;
REVOKE ALL ON FUNCTION public.pay_bill_from_account_service(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.pay_bill_from_account_service(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sell_investment_to_account(p_investment_id uuid,p_account_id uuid,p_quantity numeric,p_price numeric,p_date date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i record;v_remaining numeric;BEGIN SELECT * INTO i FROM public.investments WHERE id=p_investment_id AND user_id=auth.uid() AND deleted_at IS NULL FOR UPDATE;IF i.id IS NULL OR p_quantity<=0 OR p_price<=0 OR p_quantity>i.quantity THEN RAISE EXCEPTION 'Data penjualan investasi tidak valid';END IF;v_remaining:=i.quantity-p_quantity;INSERT INTO public.transactions(user_id,type,amount,date,account_id,name,note,tags)VALUES(auth.uid(),'income',p_quantity*p_price,p_date,p_account_id,'Jual '||i.name,'investment_sell:'||i.id,ARRAY['investment','sell']);UPDATE public.investments SET quantity=v_remaining,current_price=p_price,last_updated_at=now(),deleted_at=CASE WHEN v_remaining=0 THEN now() ELSE NULL END WHERE id=i.id;END $$;
REVOKE ALL ON FUNCTION public.sell_investment_to_account(uuid,uuid,numeric,numeric,date) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.sell_investment_to_account(uuid,uuid,numeric,numeric,date) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_debts_account ON public.debts(user_id,account_id);
CREATE INDEX IF NOT EXISTS idx_receivables_account ON public.receivables(user_id,account_id);
CREATE INDEX IF NOT EXISTS idx_bills_account ON public.bills(user_id,account_id);
CREATE INDEX IF NOT EXISTS idx_investments_account ON public.investments(user_id,account_id);
