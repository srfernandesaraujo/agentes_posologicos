
-- Allow admin to view all virtual rooms
CREATE POLICY "Admins can view all virtual rooms"
ON public.virtual_rooms
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admin to update all virtual rooms
CREATE POLICY "Admins can update all virtual rooms"
ON public.virtual_rooms
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admin to view all custom agents (for linking to rooms)
CREATE POLICY "Admins can view all custom agents"
ON public.custom_agents
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
