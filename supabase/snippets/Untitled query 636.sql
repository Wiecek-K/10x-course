 SET LOCAL role authenticated;
  SET LOCAL request.jwt.claims TO '{"sub":
  "cc1794f9-0b30-49fe-9ae4-b7d74215c9f6", "role": "authenticated"}';
  SELECT * FROM public.links;