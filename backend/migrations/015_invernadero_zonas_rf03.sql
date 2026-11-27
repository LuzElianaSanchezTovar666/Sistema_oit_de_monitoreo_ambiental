USE `simoa`;

-- Especialización exclusiva del catálogo base de ubicaciones a partes/zonas del Invernadero
UPDATE `ubicaciones`
SET
  `nombre` = 'Zona de Germinación y Semilleros',
  `tipo` = 'Germinación',
  `descripcion` = 'Área de propagación y plántulas del invernadero con control estricto de humedad y temperatura basal'
WHERE `ubicacion_id` = 'ubi-lab-01'
  AND `nombre` = 'Laboratorio' AND `tipo` = 'Laboratorio'
  AND `descripcion` = 'Laboratorio principal de control ambiental';

UPDATE `ubicaciones`
SET
  `nombre` = 'Zona de Cultivo Hidropónico',
  `tipo` = 'Cultivo',
  `descripcion` = 'Nave central de producción vegetal y camas de cultivo hidropónico del invernadero'
WHERE `ubicacion_id` = 'ubi-bio-02'
  AND `nombre` = 'Bioterio' AND `tipo` = 'Bioterio'
  AND `descripcion` = 'Recinto biológico de temperatura controlada';

UPDATE `ubicaciones`
SET
  `nombre` = 'Zona de Ventilación y Nebulización',
  `tipo` = 'Climatización',
  `descripcion` = 'Módulo de extractores, cortinas térmicas y aspersión para regulación microclimática del invernadero'
WHERE `ubicacion_id` = 'ubi-cam-03'
  AND `nombre` = 'Cámara fría' AND `tipo` = 'Cámara fría'
  AND `descripcion` = 'Unidad de refrigeración y cadena de frío';

UPDATE `ubicaciones`
SET
  `nombre` = 'Área de Fertirriego y Nutrientes',
  `tipo` = 'Fertirriego',
  `descripcion` = 'Estación de preparación de soluciones nutritivas, tanques y bombeo de riego del invernadero'
WHERE `ubicacion_id` = 'ubi-bod-04'
  AND `nombre` = 'Bodega' AND `tipo` = 'Bodega'
  AND `descripcion` = 'Almacenamiento general de insumos';

UPDATE `dispositivos` d
INNER JOIN `ubicaciones` u ON u.`ubicacion_id` = d.`ubicacion_id`
SET d.`ubicacion` = u.`nombre`
WHERE NOT (CAST(d.`ubicacion` AS BINARY) <=> CAST(u.`nombre` AS BINARY));
