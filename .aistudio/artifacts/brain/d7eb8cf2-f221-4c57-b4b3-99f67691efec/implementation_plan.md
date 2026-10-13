# Correção de Persistência, Visualizador com Zoom de Fotos e Exportação em PDF

Este plano detalha a correção completa dos problemas de salvamento de acertos no navegador, resiliência no envio de fotos de recibos com modal de ampliação interativa (zoom/fullscreen), e inclusão do botão direto "Salvar em PDF" com as fotos dos comprovantes organizadas em anexo.

---

## Decisões Confirmadas com o Usuário

> [!IMPORTANT]
> As seguintes escolhas de arquitetura e experiência foram validadas e incorporadas:
> - **Armazenamento e Salvamento de Acertos**: Camada de persistência em IndexedDB reforçada com sincronização e espelhamento automático no armazenamento local (`localStorage` snapshot), garantindo recuperação instantânea de acertos já salvos mesmo se o banco sofrer reinicialização.
> - **Ampliação e Inspeção de Imagens**: Componente de Modal Lightbox com controles de aproximação (`ZoomIn`), afastamento (`ZoomOut`), rotação 90° e modo tela cheia para leitura clara de caligrafia, valores e notas amassadas.
> - **Exportação para PDF com Comprovantes Anexados**: O botão proeminente "Salvar em PDF" gerará o documento corporativo da NDS CFTV Digital incluindo a tabela de despesas, o demonstrativo dos sócios Neto e Victor (com a dedução pessoal do vale de R$ 601,00) e todas as fotos dos comprovantes anexadas ao final com alta qualidade.

---

## 1. Visão Geral & Experiência do Usuário

O sistema **paineldeacertos (AcertoFácil)** é uma ferramenta de fechamento financeiro e divisão de lucros. Os usuários relataram que:
1. Ao enviar fotos, ocorria falha ou bloqueio quando a leitura automática da IA falhava ou demorava, impedindo o usuário de visualizar a imagem ou salvá-la manualmente.
2. Não havia ferramenta interativa para ampliar (dar zoom) nas imagens dos comprovantes ao inspecionar ou conferir lançamentos.
3. Acertos salvos não estavam sendo recarregados com segurança após fechar ou reabrir o aplicativo.
4. Faltava a opção direta de "Salvar em PDF" diretamente na tela de conferência e com as fotos em anexo.

### Fluxos Principais
```
┌────────────────────────┐      ┌───────────────────────────┐      ┌─────────────────────────────┐
│ 1. Upload de Foto      │ ───► │ 2. Visualização & Zoom    │ ───► │ 3. Salvar Acerto & Gerar PDF│
│ (Câmera ou Arquivo)    │      │ - Lightbox com Zoom/Pan   │      │ - Persistência Dupla Segura │
│ - Fallback garantido se│      │ - Inspeção de detalhes    │      │ - Botão "Salvar em PDF"     │
│   IA offline/lenta     │      │ - Edição de linhas        │      │ - Anexo das fotos no PDF    │
└────────────────────────┘      └───────────────────────────┘      └─────────────────────────────┘
```

---

## 2. Design Visual & Interface (Frontend Guidelines)

Em conformidade com as diretrizes de dashboard financeiro e anti-slop:
- **Zero-Pill Metadata**: Metadados (datas, categorias, status) são exibidos como texto limpo separado por `·` ou `/`, sem pílulas estáticas ou badges coloridos artificiais.
- **Top Bar Contract**: Barra superior limpa com o título corporativo "NDS CFTV Digital", breadcrumb contextual de navegação e botão de ação primária destacado "Salvar em PDF".
- **Alinhamento Numérico com Monospace**: Todos os valores monetários usam `tabular-nums font-mono` para alinhamento vertical exato de casas decimais.
- **Modal Lightbox de Fotos**:
  - Área escura (`bg-black/90`) para contraste máximo da imagem.
  - Barra de controle flutuante com botões de zoom in (+25%), zoom out (-25%), 100% reset, rotação (+90°) e fechar.
  - Suporte a arraste (drag/pan) quando a foto estiver ampliada acima de 100%.

---

## 3. Decisões Técnicas & Arquitetura

### A. Persistência Dupla e Resiliente (IndexedDB + Snapshot Cache)
- **Problema atual**: Se a transação do IndexedDB for interrompida ou houver incompatibilidade temporária no navegador, o acerto não aparecia na lista.
- **Solução**:
  1. `salvarAcerto`, `salvarLancamento` e `salvarImagem` gravam no IndexedDB e emitem um snapshot seguro para o cache persistente.
  2. Na inicialização (`inicializarDadosSeNecessario`), o sistema reconcilia os acertos de ambos os storages, garantindo que nenhum acerto salvo desapareça.

### B. Upload Resiliente com Fallback Automático
- **Problema atual**: Se a chamada para a IA (`/api/gemini/extract-receipt`) demorar ou falhar, o upload era cancelado e a imagem descartada.
- **Solução**:
  1. O arquivo de imagem é comprimido localmente no navegador e armazenado imediatamente.
  2. A chamada para a IA possui tempo limite e tratamento de erro suave.
  3. Se a IA responder, os dados pré-preenchidos alimentam o modal. Se falhar ou estiver offline, o modal de conferência abre normalmente com a foto carregada, permitindo inclusão manual de lançamentos e zoom imediato.

### C. Botão "Salvar em PDF" com Imagens Anexadas
- **Solução**:
  1. Botão proeminente "Salvar em PDF" integrado tanto na barra principal do acerto quanto na barra de ações da conferência.
  2. O gerador `jsPDF` adiciona ao final as páginas de "Anexo de Comprovantes", redimensionando proporcionalmente cada foto cadastrada.

---

## 4. Diagrama da Arquitetura do Sistema

```
┌────────────────────────────────────────────────────────────────────────┐
│                              INTERFACE                                 │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────┐ │
│  │   AcertosList.tsx     │  │   AcertoView.tsx      │  │ TabGeral /  │ │
│  │ - Lista de Acertos    │  │ - Botão Salvar em PDF │  │ TabPessoa / │ │
│  │ - Upload folha nova   │  │ - Abas dos Sócios     │  │ TabDivisão  │ │
│  └───────────┬───────────┘  └───────────┬───────────┘  └──────┬──────┘ │
│              │                          │                     │        │
│              ▼                          ▼                     ▼        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │     ConferenceModal.tsx & PhotoZoomModal (Visualizador Zoom)     │  │
│  │     - Controles: Zoom In, Zoom Out, Rotação, Tela Cheia          │  │
│  │     - Ação direta: Salvar em PDF & Confirmar Lançamentos         │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SERVIÇOS & PERSISTÊNCIA                         │
│                                                                        │
│   ┌───────────────────────────┐         ┌──────────────────────────┐   │
│   │   services/db.ts          │ ◄─────► │ pdfGenerator.ts          │   │
│   │ - IndexedDB primário      │         │ - Cabeçalho NDS CFTV     │   │
│   │ - Snapshot localStorage   │         │ - Resumo Neto & Victor   │   │
│   │ - Auto-recuperação        │         │ - Fotos dos Comprovantes │   │
│   └───────────────────────────┘         └──────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Próximos Passos de Execução

1. **Aprimorar `src/services/db.ts`**: Adicionar camada de sincronização e recuperação automática em caso de recarregamento.
2. **Criar Componente `PhotoZoomModal`**: Componente dedicado para zoom interativo, rotação e visualização em tela cheia de qualquer foto de comprovante anexada.
3. **Atualizar `ConferenceModal.tsx`**: Integrar o botão de ampliar imagem (`ZoomIn`), fallback caso a IA não responda, e botão direto "Salvar em PDF".
4. **Atualizar `AcertoView.tsx` e `AcertosList.tsx`**: Garantir que o upload de foto nunca descarte o arquivo mesmo em falhas de rede, e adicionar o botão de zoom nos comprovantes já salvos.
5. **Atualizar `pdfGenerator.ts`**: Habilitar a inclusão padrão das fotos dos comprovantes no final do documento em alta fidelidade.
6. **Compilar e Validar**: Executar `compile_applet` e verificar a inexistência de erros de compilação ou regressões.
