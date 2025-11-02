-- Índices adicionais recomendados (alguns já podem existir).

-- sales
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_store ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_channel ON sales(channel_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(sale_status_desc);
-- Índice parcial para consultas comuns (completas)
CREATE INDEX IF NOT EXISTS idx_sales_created_completed ON sales(created_at) WHERE sale_status_desc = 'COMPLETED';

-- product_sales
CREATE INDEX IF NOT EXISTS idx_ps_product_sale ON product_sales(product_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_ps_sale ON product_sales(sale_id);

-- delivery_addresses
CREATE INDEX IF NOT EXISTS idx_da_city ON delivery_addresses(city);
CREATE INDEX IF NOT EXISTS idx_da_neighborhood ON delivery_addresses(neighborhood);
CREATE INDEX IF NOT EXISTS idx_da_sale ON delivery_addresses(sale_id);

-- payments
CREATE INDEX IF NOT EXISTS idx_pay_sale ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_pay_type ON payments(payment_type_id);
