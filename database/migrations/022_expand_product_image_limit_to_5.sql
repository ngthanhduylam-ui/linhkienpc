ALTER TABLE product_images
  DROP CHECK chk_product_images_sort_order,
  ADD CONSTRAINT chk_product_images_sort_order CHECK (sort_order BETWEEN 1 AND 5);
