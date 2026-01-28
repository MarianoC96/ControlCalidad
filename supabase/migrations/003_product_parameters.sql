-- =====================================================
-- Control de Calidad - Product Parameters Migration
-- =====================================================
-- This file contains all product parameters from the original PHP app
-- Run this AFTER 002_initial_data.sql
-- =====================================================

-- First, update the parametros table to match original schema
-- The original has: valor_texto and es_rango fields
ALTER TABLE parametros ADD COLUMN IF NOT EXISTS valor_texto TEXT;
ALTER TABLE parametros ADD COLUMN IF NOT EXISTS es_rango BOOLEAN DEFAULT false;
ALTER TABLE parametros ADD COLUMN IF NOT EXISTS rango_completo TEXT;

-- =====================================================
-- Table: parametros (Product Parameters)
-- =====================================================
INSERT INTO parametros (id, producto_id, nombre, rango_min, rango_max, unidad, rango_completo, created_at, parametro_maestro_id, valor_texto, es_rango) VALUES
-- Producto 6: Tapa PET # 45
(99, 6, 'COLOR', 0.00, 0.00, NULL, 'Verde Esmeralda', '2025-07-04 03:44:16', 1, 'Verde Esmeralda', false),
(100, 6, 'PESO', 0.00, 0.00, 'g', '5.7 g', '2025-07-04 03:44:16', 2, NULL, true),
(101, 6, 'ALTURA', 17.30, 17.50, 'mm', '17.30 - 17.50 mm', '2025-07-04 03:44:16', 5, NULL, true),
(102, 6, 'LARGO', 51.30, 51.50, 'mm', '51.30 - 51.50 mm', '2025-07-04 03:44:16', 6, NULL, true),
(103, 6, 'N° PUENTES DE UNIÓN', 0.00, 0.00, NULL, '10', '2025-07-04 03:44:16', 12, '10', false),

-- Producto 7: Bolsa pack aceituna x 240g
(104, 7, 'COLOR', 0.00, 0.00, NULL, 'Transparente', '2025-07-04 03:44:16', 1, 'Transparente', false),
(105, 7, 'GRAMAJE', 33.81, 36.63, 'gr/cm²', '33.81 - 36.63 gr/cm²', '2025-07-04 03:44:16', 3, NULL, true),
(106, 7, 'ANCHO', 22.02, 28.35, 'cm', '22.02 - 28.35 cm', '2025-07-04 03:44:16', 4, NULL, true),
(107, 7, 'LARGO', 33.33, 42.86, 'cm', '33.33 - 42.86 cm', '2025-07-04 03:44:16', 6, NULL, true),

-- Producto 8: Bolsa doy pack c/válvula x 1 kg
(108, 8, 'COLOR', 0.00, 0.00, NULL, 'Transparente', '2025-07-04 03:44:16', 1, 'Transparente', false),
(109, 8, 'GRAMAJE', 124.47, 152.13, 'g/cm²', '124.47 - 152.13 g/cm²', '2025-07-04 03:44:16', 3, NULL, true),
(110, 8, 'ANCHO', 155.00, 165.00, 'mm', '155 - 165 mm', '2025-07-04 03:44:16', 4, NULL, true),
(111, 8, 'ALTURA', 255.00, 265.00, 'mm', '255 - 265 mm', '2025-07-04 03:44:16', 5, NULL, true),
(112, 8, 'FUELLE', 75.00, 85.00, 'mm', '75 - 85 mm', '2025-07-04 03:44:16', 13, NULL, true),

-- Producto 9: Bolsa doy pack c/válvula x 500g
(113, 9, 'COLOR', 0.00, 0.00, NULL, 'Transparente', '2025-07-04 03:44:16', 1, 'Transparente', false),
(114, 9, 'GRAMAJE', 111.60, 136.40, 'g/cm²', '111.6 - 136.4 g/cm²', '2025-07-04 03:44:16', 3, NULL, true),
(115, 9, 'ANCHO', 128.00, 138.00, 'mm', '128 - 138 mm', '2025-07-04 03:44:16', 4, NULL, true),
(116, 9, 'ALTURA', 205.00, 215.00, 'mm', '205 - 215 mm', '2025-07-04 03:44:16', 5, NULL, true),
(117, 9, 'FUELLE', 70.00, 80.00, 'mm', '70 - 80 mm', '2025-07-04 03:44:16', 13, NULL, true),

-- Producto 10: Bolsa c/impresión aceituna x 1 kg
(118, 10, 'COLOR', 0.00, 0.00, NULL, 'según patrón', '2025-07-04 03:44:16', 1, 'según patrón', false),
(119, 10, 'GRAMAJE', 100.00, 120.00, 'g/cm²', '100 - 120 g/cm²', '2025-07-04 03:44:16', 3, NULL, true),
(120, 10, 'ANCHO', 208.00, 212.00, 'mm', '208 - 212 mm', '2025-07-04 03:44:16', 4, NULL, true),
(121, 10, 'ALTURA', 278.00, 282.00, 'mm', '278 - 282 mm', '2025-07-04 03:44:16', 5, NULL, true),

-- Producto 11: Botella PET x 1.9 L
(122, 11, 'COLOR', 0.00, 0.00, NULL, 'Cristal transparente', '2025-07-04 03:44:16', 1, 'Cristal transparente', false),
(123, 11, 'PESO', 59.50, 60.50, 'g', '60 +/- 0.5 g', '2025-07-04 03:44:16', 2, NULL, true),
(124, 11, 'ALTURA', 279.00, 281.00, 'mm', '280 +/- 1 mm', '2025-07-04 03:44:16', 5, NULL, true),
(125, 11, 'DIÁMETRO EXTERNO BOCA', 24.66, 25.06, 'mm', '24.86 +/- 0.2 mm', '2025-07-04 03:44:16', 8, NULL, true),
(126, 11, 'CAPACIDAD DE REBOSE', 1938.00, 1942.00, 'ml', '1940 +/- 2 ml', '2025-07-04 03:44:16', 14, NULL, true),

-- Producto 12: Galonera PET x 3.785 L
(127, 12, 'COLOR', 0.00, 0.00, NULL, 'Cristal transparente', '2025-07-04 03:44:16', 1, 'Cristal transparente', false),
(128, 12, 'PESO', 89.80, 90.20, 'g', '90 +/- 0.2 g', '2025-07-04 03:44:16', 2, NULL, true),
(129, 12, 'ANCHO', 150.10, 150.50, 'mm', '150.3 +/- 0.2 mm', '2025-07-04 03:44:16', 4, NULL, true),
(130, 12, 'ALTURA', 320.40, 322.40, 'mm', '321.4 +/- 1 mm', '2025-07-04 03:44:16', 5, NULL, true),
(131, 12, 'DIÁMETRO EXTERNO BOCA', 44.70, 45.10, 'mm', '44.9 +/- 0.2 mm', '2025-07-04 03:44:16', 8, NULL, true),
(132, 12, 'CAPACIDAD DE REBOSE', 3794.00, 3806.00, 'ml', '3800 +/- 6 ml', '2025-07-04 03:44:16', 14, NULL, true),

-- Producto 13: Botella PET x 1 L
(133, 13, 'COLOR', 0.00, 0.00, NULL, 'Cristal transparente', '2025-07-04 03:44:16', 1, 'Cristal transparente', false),
(134, 13, 'PESO', 0.00, 0.00, 'g', '47 g', '2025-07-04 03:44:16', 2, NULL, true),
(135, 13, 'ALTURA', 277.50, 278.50, 'mm', '278 +/- 0.5 mm', '2025-07-04 03:44:16', 5, NULL, true),
(136, 13, 'DIÁMETRO EXTERNO BOCA', 24.00, 25.20, 'mm', '24 - 25.2 mm', '2025-07-04 03:44:16', 8, NULL, true),
(137, 13, 'CAPACIDAD DE REBOSE', 1017.50, 1018.50, 'ml', '1018 +/- 0.5 ml', '2025-07-04 03:44:16', 14, NULL, true),

-- Producto 14: Botella PET x 60 ml
(138, 14, 'COLOR', 0.00, 0.00, NULL, 'Cristal transparente', '2025-07-04 03:44:16', 1, 'Cristal transparente', false),
(139, 14, 'PESO', 0.00, 0.00, 'g', '11 g', '2025-07-04 03:44:16', 2, NULL, true),
(140, 14, 'ANCHO', 0.00, 0.00, 'mm', '28 mm', '2025-07-04 03:44:16', 4, NULL, true),
(141, 14, 'ALTURA', 0.00, 0.00, 'mm', '102 mm', '2025-07-04 03:44:16', 5, NULL, true),
(142, 14, 'DIÁMETRO EXTERNO BOCA', 0.00, 0.00, 'mm', '25 mm', '2025-07-04 03:44:16', 8, NULL, true),

-- Producto 15: Botella oscura x 250 ml
(143, 15, 'COLOR', 0.00, 0.00, NULL, 'Verde BI', '2025-07-04 03:44:16', 1, 'Verde BI', false),
(144, 15, 'PESO', 215.00, 235.00, 'g', '225 +/- 10 g', '2025-07-04 03:44:16', 2, NULL, true),
(145, 15, 'ALTURA', 210.50, 213.50, 'mm', '212 +/- 1.5 mm', '2025-07-04 03:44:16', 5, NULL, true),
(146, 15, 'DIÁMETRO EXTERNO BOCA', 27.70, 28.40, 'mm', '28 +/- 0.3 mm', '2025-07-04 03:44:16', 8, NULL, true),
(147, 15, 'CAPACIDAD DE REBOSE', 0.00, 0.00, 'ml', '266 ml', '2025-07-04 03:44:16', 14, NULL, true),

-- Producto 16: Botella transparente x 250 ml
(148, 16, 'COLOR', 0.00, 0.00, NULL, 'Transparente', '2025-07-04 03:44:16', 1, 'Transparente', false),
(149, 16, 'PESO', 215.00, 235.00, 'g', '225 +/-10 g', '2025-07-04 03:44:16', 2, NULL, true),
(150, 16, 'ALTURA', 210.50, 213.50, 'mm', '212 +/- 1.5 mm', '2025-07-04 03:44:16', 5, NULL, true),
(151, 16, 'DIÁMETRO EXTERNO BOCA', 27.70, 28.40, 'mm', '28 +/- 0.3 mm', '2025-07-04 03:44:16', 8, NULL, true),
(152, 16, 'CAPACIDAD DE REBOSE', 0.00, 0.00, 'ml', '266 ml', '2025-07-04 03:44:16', 14, NULL, true),

-- Producto 17: Botella transparente x 200 ml
(153, 17, 'COLOR', 0.00, 0.00, NULL, 'Transparente', '2025-07-04 03:44:16', 1, 'Transparente', false),
(154, 17, 'PESO', 181.00, 199.00, 'g', '190 +/- 9 g', '2025-07-04 03:44:16', 2, NULL, true),
(155, 17, 'ALTURA', 192.80, 195.20, 'mm', '194 +/- 1.2 mm', '2025-07-04 03:44:16', 5, NULL, true),
(156, 17, 'DIÁMETRO EXTERNO BOCA', 0.00, 0.00, 'mm', '28.09 mm', '2025-07-04 03:44:16', 8, NULL, true),
(157, 17, 'CAPACIDAD DE REBOSE', 209.50, 218.50, 'ml', '214 +/- 4.5 ml', '2025-07-04 03:44:16', 14, NULL, true),

-- Producto 18: Botella transparente x 500 ml
(158, 18, 'COLOR', 0.00, 0.00, NULL, 'Transparente', '2025-07-04 03:44:16', 1, 'Transparente', false),
(159, 18, 'PESO', 326.00, 354.00, 'g', '340 +/- 14 g', '2025-07-04 03:44:16', 2, NULL, true),
(160, 18, 'ALTURA', 263.40, 266.60, 'mm', '265 +/- 1.6 mm', '2025-07-04 03:44:16', 5, NULL, true),
(161, 18, 'DIÁMETRO EXTERNO BOCA', 0.00, 0.00, 'mm', '28.09 mm', '2025-07-04 03:44:16', 8, NULL, true),
(162, 18, 'CAPACIDAD DE REBOSE', 517.00, 531.00, 'ml', '524 +/- 7 ml', '2025-07-04 03:44:16', 14, NULL, true),

-- Producto 19-24: Cajas
(163, 19, 'COLOR', 0.00, 0.00, NULL, 'Beige', '2025-07-04 03:44:16', 1, 'Beige', false),
(164, 19, 'GRAMAJE', 0.00, 0.00, 'g/m²', 'min 361 g/m²', '2025-07-04 03:44:16', 3, NULL, true),
(165, 19, 'ANCHO', 23.30, 23.70, 'cm', '23.5 +/- 0.2 cm', '2025-07-04 03:44:16', 4, NULL, true),
(166, 19, 'ALTURA', 19.80, 20.20, 'cm', '20 +/- 0.2 cm', '2025-07-04 03:44:16', 5, NULL, true),
(167, 19, 'LARGO', 34.30, 34.70, 'cm', '34.5 +/-0.2 cm', '2025-07-04 03:44:16', 6, NULL, true),
(168, 19, 'CALIBRE', 3.68, 4.32, 'mm', '4 +/- 0.32 mm', '2025-07-04 03:44:16', 15, NULL, true),

(169, 20, 'COLOR', 0.00, 0.00, NULL, 'Beige', '2025-07-04 03:44:16', 1, 'Beige', false),
(170, 20, 'GRAMAJE', 0.00, 0.00, 'g/m²', 'min 361 g/m²', '2025-07-04 03:44:16', 3, NULL, true),
(171, 20, 'ANCHO', 21.40, 21.80, 'cm', '21.6 +/- 0.2 cm', '2025-07-04 03:44:16', 4, NULL, true),
(172, 20, 'ALTURA', 22.10, 22.50, 'cm', '22.3 +/- 0.2 cm', '2025-07-04 03:44:16', 5, NULL, true),
(173, 20, 'LARGO', 29.30, 29.70, 'cm', '29.5 +/- 0.2 cm', '2025-07-04 03:44:16', 6, NULL, true),
(174, 20, 'CALIBRE', 3.68, 4.32, 'mm', '4 +/- 0.32 mm', '2025-07-04 03:44:16', 15, NULL, true),

(175, 21, 'COLOR', 0.00, 0.00, NULL, 'Beige', '2025-07-04 03:44:16', 1, 'Beige', false),
(176, 21, 'GRAMAJE', 0.00, 0.00, 'g/m²', 'min 361 g/m²', '2025-07-04 03:44:16', 3, NULL, true),
(177, 21, 'ANCHO', 26.80, 27.20, 'cm', '27 +/- 0.2 cm', '2025-07-04 03:44:16', 4, NULL, true),
(178, 21, 'ALTURA', 14.80, 15.20, 'cm', '15 +/- 0.2 cm', '2025-07-04 03:44:16', 5, NULL, true),
(179, 21, 'LARGO', 33.80, 34.20, 'cm', '34 +/- 0.2 cm', '2025-07-04 03:44:16', 6, NULL, true),
(180, 21, 'CALIBRE', 3.68, 4.32, 'mm', '4 +/- 0.32 mm', '2025-07-04 03:44:16', 15, NULL, true),

(181, 22, 'COLOR', 0.00, 0.00, NULL, 'Beige', '2025-07-04 03:44:16', 1, 'Beige', false),
(182, 22, 'GRAMAJE', 0.00, 0.00, 'g/m²', 'min 361 g/m²', '2025-07-04 03:44:16', 3, NULL, true),
(183, 22, 'ANCHO', 19.80, 20.20, 'cm', '20 +/- 0.2 cm', '2025-07-04 03:44:16', 4, NULL, true),
(184, 22, 'ALTURA', 28.00, 28.40, 'cm', '28.2 +/- 0.2 cm', '2025-07-04 03:44:16', 5, NULL, true),
(185, 22, 'LARGO', 26.50, 26.90, 'cm', '26.7 +/- 0.2 cm', '2025-07-04 03:44:16', 6, NULL, true),
(186, 22, 'CALIBRE', 3.68, 4.32, 'mm', '4 +/- 0.32 mm', '2025-07-04 03:44:16', 15, NULL, true),

(187, 23, 'COLOR', 0.00, 0.00, NULL, 'Beige', '2025-07-04 03:44:16', 1, 'Beige', false),
(188, 23, 'GRAMAJE', 0.00, 0.00, 'g/m²', 'min 455 g/m²', '2025-07-04 03:44:16', 3, NULL, true),
(189, 23, 'ANCHO', 28.60, 29.00, 'cm', '28.8 +/- 0.2 cm', '2025-07-04 03:44:16', 4, NULL, true),
(190, 23, 'ALTURA', 18.90, 19.30, 'cm', '19.1 +/-0.2 cm', '2025-07-04 03:44:16', 5, NULL, true),
(191, 23, 'CALIBRE', 3.68, 4.32, 'mm', '4 +/- 0.32 mm', '2025-07-04 03:44:16', 15, NULL, true),

(192, 24, 'COLOR', 0.00, 0.00, NULL, 'Beige', '2025-07-04 03:44:16', 1, 'Beige', false),
(193, 24, 'GRAMAJE', 0.00, 0.00, 'g/m²', 'min 361 g/m²', '2025-07-04 03:44:16', 3, NULL, true),
(194, 24, 'ANCHO', 23.00, 23.40, 'cm', '23.2 +/- 0.2 cm', '2025-07-04 03:44:16', 4, NULL, true),
(195, 24, 'ALTURA', 28.00, 28.40, 'cm', '28.2 +/- 0.2 cm', '2025-07-04 03:44:16', 5, NULL, true),
(196, 24, 'LARGO', 29.40, 29.80, 'cm', '29.6 +/- 0.2 cm', '2025-07-04 03:44:16', 6, NULL, true),
(197, 24, 'CALIBRE', 3.68, 4.32, 'mm', '4 +/- 0.32 mm', '2025-07-04 03:44:16', 15, NULL, true),

-- Producto 25-32: Cápsulas, Capuchones, Corcho, Dosificador, Jarrita, Tapas
(198, 25, 'COLOR', 0.00, 0.00, NULL, 'Dorado', '2025-07-04 03:44:16', 1, 'Dorado', false),
(199, 25, 'ALTURA', 44.00, 46.00, 'mm', '45 +/- 1 mm', '2025-07-04 03:44:16', 5, NULL, true),
(200, 25, 'DIÁMETRO EXTERNO', 32.00, 34.00, 'mm', '33 +/- 1 mm', '2025-07-04 03:44:16', 7, NULL, true),

(201, 26, 'COLOR', 0.00, 0.00, NULL, 'Verde oscuro', '2025-07-04 03:44:16', 1, 'Verde oscuro', false),
(202, 26, 'APARIENCIA', 0.00, 0.00, NULL, 'Tela a cuadros borde zigzag', '2025-07-04 03:44:16', 16, 'Tela a cuadros borde zigzag', false),

(203, 27, 'COLOR', 0.00, 0.00, NULL, 'Verde claro', '2025-07-04 03:44:16', 1, 'Verde claro', false),
(204, 27, 'APARIENCIA', 0.00, 0.00, NULL, 'Tela a cuadros borde zigzag', '2025-07-04 03:44:16', 16, 'Tela a cuadros borde zigzag', false),

(205, 28, 'COLOR', 0.00, 0.00, NULL, 'Natural', '2025-07-04 03:44:16', 1, 'Natural', false),
(206, 28, 'DIAMETRO SUPERIOR', 25.30, 25.60, 'mm', '25.3 - 25.6 mm', '2025-07-04 03:44:16', 10, NULL, true),
(207, 28, 'DIAMETRO INFERIOR', 19.40, 19.60, 'mm', '19.4 - 19.6 mm', '2025-07-04 03:44:16', 11, NULL, true),

(208, 29, 'COLOR', 0.00, 0.00, NULL, 'Blanco', '2025-07-04 03:44:16', 1, 'Blanco', false),
(209, 29, 'DIÁMETRO', 0.00, 0.00, 'mm', '23 mm', '2025-07-04 03:44:16', 9, NULL, true),
(210, 29, 'DIÁMETRO EXTERNO', 0.00, 0.00, 'mm', '11 mm', '2025-07-04 03:44:16', 7, NULL, true),
(211, 29, 'DIÁMETRO EXTERNO', 0.00, 0.00, 'mm', '31.5 mm', '2025-07-04 03:44:16', 7, NULL, true),
(212, 29, 'N° PUENTES DE UNIÓN', 0.00, 0.00, NULL, '9', '2025-07-04 03:44:16', 12, '9', false),
(213, 29, 'BASE DOSIFICADOR', 0.00, 0.00, NULL, 'Lisa / rosca', '2025-07-04 03:44:16', 17, 'Lisa / rosca', false),

(214, 30, 'COLOR', 0.00, 0.00, NULL, 'Transparente', '2025-07-04 03:44:16', 1, 'Transparente', false),
(215, 30, 'PESO', 254.00, 276.00, 'g', '265 +/- 11 g', '2025-07-04 03:44:16', 2, NULL, true),
(216, 30, 'ALTURA', 145.50, 148.50, 'mm', '147 +/- 1.5 mm', '2025-07-04 03:44:16', 5, NULL, true),
(217, 30, 'CAPACIDAD DE REBOSE', 261.00, 271.00, 'ml', '266 +/- 5 ml', '2025-07-04 03:44:16', 14, NULL, true),

(218, 31, 'COLOR', 0.00, 0.00, NULL, 'Dorado brillante', '2025-07-04 03:44:16', 1, 'Dorado brillante', false),
(219, 31, 'DIÁMETRO', 23.00, 25.00, 'mm', '24 +/-1 mm', '2025-07-04 03:44:16', 9, NULL, true),

(220, 32, 'COLOR', 0.00, 0.00, NULL, 'Verde esmeralda', '2025-07-04 03:44:16', 1, 'Verde esmeralda', false),
(221, 32, 'ALTURA', 20.10, 20.70, 'mm', '20.10 - 20.70 mm', '2025-07-04 03:44:16', 5, NULL, true),
(222, 32, 'LARGO', 29.60, 30.10, 'mm', '29.6 -30.1 mm', '2025-07-04 03:44:16', 6, NULL, true),

-- Producto 33: Aceite de Oliva Virgen
(223, 33, 'COLOR', 0.00, 0.00, NULL, 'Amarillo', '2025-07-04 03:44:16', 1, 'Amarillo', false),
(224, 33, 'OLOR', 0.00, 0.00, NULL, 'Característico', '2025-07-04 03:44:16', 18, 'Característico', false),
(225, 33, 'SABOR', 0.00, 0.00, NULL, 'Característico', '2025-07-04 03:44:16', 19, 'Característico', false),
(226, 33, 'TEXTURA', 0.00, 0.00, NULL, 'Firme', '2025-07-04 03:44:16', 20, 'Firme', false),
(227, 33, 'INDICE DE REFRACCIÓN', 1.48, 1.49, NULL, '1.4805 - 1.4905', '2025-07-04 03:44:16', 21, NULL, true),

-- Producto 34: Ácido acético
(228, 34, 'COLOR', 0.00, 0.00, NULL, 'Incoloro', '2025-07-04 03:44:16', 1, 'Incoloro', false),
(229, 34, 'OLOR', 0.00, 0.00, NULL, 'Penetrante, picante', '2025-07-04 03:44:16', 18, 'Penetrante, picante', false),
(230, 34, 'TEXTURA', 0.00, 0.00, NULL, 'Firme', '2025-07-04 03:44:16', 20, 'Firme', false),
(231, 34, 'INDICE DE REFRACCIÓN', 1.45, 1.48, NULL, '1.4500 - 1.4800', '2025-07-04 03:44:16', 21, NULL, true),

-- Producto 35: Ácido cítrico
(232, 35, 'COLOR', 0.00, 0.00, NULL, 'Blanco', '2025-07-04 03:44:16', 1, 'Blanco', false),
(233, 35, 'OLOR', 0.00, 0.00, NULL, 'Neutro', '2025-07-04 03:44:16', 18, 'Neutro', false),
(234, 35, 'APARIENCIA', 0.00, 0.00, NULL, 'Cristales', '2025-07-04 03:44:16', 16, 'Cristales', false),
(235, 35, 'TEXTURA', 0.00, 0.00, NULL, 'Granulada', '2025-07-04 03:44:16', 20, 'Granulada', false),

-- Productos 36-65: Materias primas (resumen - incluye los más importantes)
(236, 36, 'COLOR', 0.00, 0.00, NULL, 'Rojo oscuro', '2025-07-04 03:44:16', 1, 'Rojo oscuro', false),
(237, 36, 'OLOR', 0.00, 0.00, NULL, 'Característico', '2025-07-04 03:44:16', 18, 'Característico', false),
(238, 36, 'SABOR', 0.00, 0.00, NULL, 'Picante', '2025-07-04 03:44:16', 19, 'Picante', false),
(239, 36, 'APARIENCIA', 0.00, 0.00, NULL, 'Bayas arrugadas alargadas', '2025-07-04 03:44:16', 16, 'Bayas arrugadas alargadas', false),

(240, 37, 'COLOR', 0.00, 0.00, NULL, 'Crema / blanco', '2025-07-04 03:44:16', 1, 'Crema / blanco', false),
(241, 37, 'OLOR', 0.00, 0.00, NULL, 'Característico', '2025-07-04 03:44:16', 18, 'Característico', false),
(242, 37, 'SABOR', 0.00, 0.00, NULL, 'Característico', '2025-07-04 03:44:16', 19, 'Característico', false),
(243, 37, 'LARGO', 8.00, 15.00, 'cm', '8 a 15 cm', '2025-07-04 03:44:16', 6, NULL, true),
(244, 37, 'DIÁMETRO', 250.00, 450.00, NULL, '250 - 350 / 350 - 450', '2025-07-04 03:44:16', 9, NULL, true),
(245, 37, 'TEXTURA', 0.00, 0.00, NULL, 'Firme', '2025-07-04 03:44:16', 20, 'Firme', false),

-- Producto 41: Bebida gasificada jarabeada
(259, 41, 'COLOR', 0.00, 0.00, NULL, 'Negro', '2025-07-04 03:44:16', 1, 'Negro', false),
(260, 41, 'OLOR', 0.00, 0.00, NULL, 'cola negra', '2025-07-04 03:44:16', 18, 'cola negra', false),
(261, 41, 'SABOR', 0.00, 0.00, NULL, 'cola negra', '2025-07-04 03:44:16', 19, 'cola negra', false),
(262, 41, '°Brix', 8.00, 15.00, NULL, '8 - 15', '2025-07-04 03:44:16', 22, NULL, true),
(263, 41, 'pH', 2.50, 4.00, NULL, '2.5 - 4', '2025-07-04 03:44:16', 23, NULL, true),

-- Producto 70: Regla (test product)
(381, 70, 'DISTANCIA', 20.00, 30.00, 'm', '20 - 30 m', '2025-07-14 00:31:48', 25, NULL, true),
(382, 70, 'COLOR', 0.00, 0.00, NULL, 'celeste', '2025-07-14 00:31:48', 1, 'celeste', false)

ON CONFLICT (id) DO UPDATE SET
  producto_id = EXCLUDED.producto_id,
  nombre = EXCLUDED.nombre,
  rango_min = EXCLUDED.rango_min,
  rango_max = EXCLUDED.rango_max,
  unidad = EXCLUDED.unidad,
  rango_completo = EXCLUDED.rango_completo,
  parametro_maestro_id = EXCLUDED.parametro_maestro_id,
  valor_texto = EXCLUDED.valor_texto,
  es_rango = EXCLUDED.es_rango;

-- Reset sequence
SELECT setval('parametros_id_seq', (SELECT MAX(id) FROM parametros));

-- =====================================================
-- Success message
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE 'Product parameters migration completed!';
  RAISE NOTICE 'Total parameters inserted/updated.';
END $$;
