/*
  # Create Transactions Table

  1. New Tables
    - `transactions`
      - `id` (bigint, primary key)
      - `title` (text)
      - `price` (decimal)
      - `description` (text)
      - `category` (text)
      - `image` (text)
      - `sold` (boolean)
      - `dateOfSale` (timestamp)

  2. Security
    - Enable RLS on transactions table
    - Add policies for authenticated users to read data
*/

CREATE TABLE IF NOT EXISTS transactions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title text NOT NULL,
  price decimal(10,2) NOT NULL,
  description text,
  category text NOT NULL,
  image text,
  sold boolean DEFAULT false,
  dateOfSale timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users to read transactions
CREATE POLICY "Allow public read access"
  ON transactions
  FOR SELECT
  TO public
  USING (true);