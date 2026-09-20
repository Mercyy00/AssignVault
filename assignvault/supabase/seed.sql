-- seed.sql: Idempotent seed script for AssignVault
-- Safe to run multiple times without duplicating or corrupting records.

-- 1. Seed Subjects
INSERT INTO subjects (slug, name, sort_order)
VALUES
  ('csharp', 'C#', 1),
  ('core-java', 'Core Java', 2),
  ('basic-python', 'Basic Python', 3),
  ('react-js', 'React JS', 4)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

-- 2. Seed Batches
INSERT INTO batches (name, sort_order)
VALUES
  ('P1', 1),
  ('P2', 2),
  ('P3', 3),
  ('P4', 4)
ON CONFLICT (name) DO UPDATE
SET
  sort_order = EXCLUDED.sort_order;

-- 3. Seed Assignments (1 to 20 for each of the 4 subjects)
DO $$
DECLARE
  sub RECORD;
  num INT;
BEGIN
  FOR sub IN SELECT id, slug, name FROM subjects LOOP
    FOR num IN 1..20 LOOP
      INSERT INTO assignments (subject_id, number, title)
      VALUES (sub.id, num, sub.name || ' Practical Assignment ' || num)
      ON CONFLICT (subject_id, number) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
