
-- Admin can update agents
CREATE POLICY "Admins can update agents"
ON public.agents FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can insert credits for any user
CREATE POLICY "Admins can insert credits"
ON public.credits_ledger FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin can view all credits
CREATE POLICY "Admins can view all credits"
ON public.credits_ledger FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
