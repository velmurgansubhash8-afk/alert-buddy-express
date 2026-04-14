
INSERT INTO storage.buckets (id, name, public) VALUES ('prescriptions', 'prescriptions', true);

CREATE POLICY "Authenticated users can upload prescriptions"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'prescriptions');

CREATE POLICY "Anyone can view prescriptions"
ON storage.objects FOR SELECT
USING (bucket_id = 'prescriptions');

CREATE POLICY "Users can delete their own prescriptions"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'prescriptions' AND auth.uid()::text = (storage.foldername(name))[1]);
