# Dataset sanitizado do dashboard

O repositório público contém somente uma visão derivada e sanitizada do corpus 2025+.

O único transporte canônico está em `data/final_chunks/`: partes Base64 de um GZIP validado. O backend concatena as partes na ordem registrada em `data/metadata.json`, decodifica Base64, verifica tamanho e SHA-256, descomprime o payload e só então libera os indicadores.

O dataset guarda números de protocolo, datas codificadas como deslocamento, macroprocesso, categoria, status operacional e uma impressão digital não reversível usada para detectar mudanças da origem. Não publica nomes, CPF/CNPJ, observações livres nem campos auxiliares do ETL. O gargalo exibido é derivado deterministicamente do status pelo backend.

Esta é uma base minimizada, não anonimizada: protocolo e datas podem permitir correlação indireta. A decisão sobre restringir também o drill-down permanece administrativa.

Antes de responder indicadores, o backend também valida total de registros, unicidade de `ProtocoloID`, coerência temporal e ausência dos campos proibidos.
