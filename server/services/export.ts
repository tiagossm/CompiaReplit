import type { Inspection, ActionPlan, Organization, ChecklistTemplate } from "@shared/schema";
import { generateQRCode } from "./documents";

// PDF Export functionality
export async function exportToPDF(data: any, type: "inspection" | "report" | "checklist"): Promise<Buffer> {
  // Create HTML structure based on type
  let html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; color: #333; line-height: 1.6; padding: 40px; }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          padding: 20px; 
          background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); 
          color: white; 
          margin-bottom: 30px;
          border-radius: 8px;
        }
        .logo { font-size: 28px; font-weight: bold; }
        .title { font-size: 24px; margin: 20px 0; color: #1E293B; }
        .subtitle { font-size: 18px; color: #475569; margin: 15px 0; }
        .section { margin: 20px 0; padding: 20px; background: #F8FAFC; border-radius: 8px; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th { background: #3B82F6; color: white; padding: 12px; text-align: left; }
        .table td { padding: 10px; border-bottom: 1px solid #E2E8F0; }
        .table tr:nth-child(even) { background: #F8FAFC; }
        .badge { 
          display: inline-block; 
          padding: 4px 12px; 
          border-radius: 12px; 
          font-size: 12px; 
          font-weight: bold; 
          margin: 0 4px;
        }
        .badge.critical { background: #FEE2E2; color: #991B1B; }
        .badge.high { background: #FED7AA; color: #9A3412; }
        .badge.medium { background: #FEF3C7; color: #92400E; }
        .badge.low { background: #D1FAE5; color: #065F46; }
        .footer { 
          margin-top: 40px; 
          padding: 20px; 
          text-align: center; 
          color: #64748B; 
          border-top: 2px solid #E2E8F0; 
        }
        .qr-code { width: 150px; height: 150px; margin: 20px auto; }
        .metric-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          margin: 10px 0;
        }
        .metric-value { font-size: 36px; font-weight: bold; color: #3B82F6; }
        .metric-label { color: #64748B; margin-top: 5px; }
        .chart-placeholder {
          width: 100%;
          height: 200px;
          background: linear-gradient(45deg, #F1F5F9 25%, transparent 25%),
                      linear-gradient(-45deg, #F1F5F9 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, #F1F5F9 75%),
                      linear-gradient(-45deg, transparent 75%, #F1F5F9 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
          border-radius: 8px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
  `;

  if (type === "inspection") {
    const inspection = data as Inspection;
    const qrCodeData = await generateQRCode(`inspection-${inspection.id}`);
    
    html += `
      <div class="header">
        <div class="logo">COMPIA</div>
        <div>Relatório de Inspeção</div>
      </div>
      
      <h1 class="title">${inspection.title}</h1>
      <p class="subtitle">${inspection.description || 'Sem descrição'}</p>
      
      <div class="section">
        <h2>Informações Gerais</h2>
        <table class="table">
          <tr>
            <td><strong>ID da Inspeção:</strong></td>
            <td>${inspection.id}</td>
          </tr>
          <tr>
            <td><strong>Local:</strong></td>
            <td>${inspection.location}</td>
          </tr>
          <tr>
            <td><strong>Data:</strong></td>
            <td>${new Date(inspection.createdAt || '').toLocaleDateString('pt-BR')}</td>
          </tr>
          <tr>
            <td><strong>Status:</strong></td>
            <td><span class="badge ${inspection.status}">${translateStatus(inspection.status)}</span></td>
          </tr>
          <tr>
            <td><strong>Inspetor:</strong></td>
            <td>${inspection.inspectorId}</td>
          </tr>
        </table>
      </div>
      
      <div class="section">
        <h2>Checklist de Verificação</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Norma</th>
              <th>Conformidade</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            ${renderChecklistItems(inspection.checklist as any[])}
          </tbody>
        </table>
      </div>
      
      ${inspection.findings && (inspection.findings as any[]).length > 0 ? `
        <div class="section">
          <h2>Não Conformidades Encontradas</h2>
          <table class="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Descrição</th>
                <th>Severidade</th>
                <th>Norma</th>
              </tr>
            </thead>
            <tbody>
              ${renderFindings(inspection.findings as any[])}
            </tbody>
          </table>
        </div>
      ` : ''}
      
      ${inspection.recommendations ? `
        <div class="section">
          <h2>Recomendações</h2>
          <p>${inspection.recommendations}</p>
        </div>
      ` : ''}
      
      ${inspection.aiAnalysis ? `
        <div class="section">
          <h2>Análise de Inteligência Artificial</h2>
          ${renderAIAnalysis(inspection.aiAnalysis as any)}
        </div>
      ` : ''}
      
      <div class="qr-code">
        <img src="${qrCodeData}" alt="QR Code" style="width: 100%; height: 100%;">
      </div>
      
      <div class="footer">
        <p>Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        <p>COMPIA - Sistema Inteligente de Segurança do Trabalho</p>
      </div>
    </body>
    </html>
  `;
  } else if (type === "report") {
    html += `
      <div class="header">
        <div class="logo">COMPIA</div>
        <div>Relatório Executivo</div>
      </div>
      
      <h1 class="title">Relatório de Conformidade e Segurança</h1>
      <p class="subtitle">Período: ${data.period?.start || 'N/A'} - ${data.period?.end || 'N/A'}</p>
      
      <div class="section">
        <h2>Resumo Executivo</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
          <div class="metric-card">
            <div class="metric-value">${data.metrics?.compliance?.rate || 0}%</div>
            <div class="metric-label">Taxa de Conformidade</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.metrics?.inspections?.total || 0}</div>
            <div class="metric-label">Total de Inspeções</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.metrics?.actionPlans?.completed || 0}</div>
            <div class="metric-label">Planos Concluídos</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.metrics?.actionPlans?.overdue || 0}</div>
            <div class="metric-label">Planos em Atraso</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h2>Análise de Tendências</h2>
        <div class="chart-placeholder"></div>
      </div>
      
      <div class="section">
        <h2>Matriz de Risco</h2>
        <table class="table">
          <tr>
            <td><strong>Alto Risco:</strong></td>
            <td>${(data.metrics?.riskMatrix?.high || []).join(', ') || 'Nenhum'}</td>
          </tr>
          <tr>
            <td><strong>Médio Risco:</strong></td>
            <td>${(data.metrics?.riskMatrix?.medium || []).join(', ') || 'Nenhum'}</td>
          </tr>
          <tr>
            <td><strong>Baixo Risco:</strong></td>
            <td>${(data.metrics?.riskMatrix?.low || []).join(', ') || 'Nenhum'}</td>
          </tr>
        </table>
      </div>
      
      <div class="section">
        <h2>Recomendações</h2>
        <ul>
          ${(data.recommendations || []).map((rec: string) => `<li>${rec}</li>`).join('')}
        </ul>
      </div>
      
      <div class="footer">
        <p>Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        <p>COMPIA - Sistema Inteligente de Segurança do Trabalho</p>
      </div>
    </body>
    </html>
  `;
  } else if (type === "checklist") {
    const template = data as ChecklistTemplate;
    
    html += `
      <div class="header">
        <div class="logo">COMPIA</div>
        <div>Template de Checklist</div>
      </div>
      
      <h1 class="title">${template.name}</h1>
      <p class="subtitle">${template.description || 'Sem descrição'}</p>
      
      <div class="section">
        <h2>Informações do Template</h2>
        <table class="table">
          <tr>
            <td><strong>Categoria:</strong></td>
            <td>${template.category}</td>
          </tr>
          <tr>
            <td><strong>Versão:</strong></td>
            <td>${template.version || 1}</td>
          </tr>
          <tr>
            <td><strong>Total de Itens:</strong></td>
            <td>${(template.items as any[]).length}</td>
          </tr>
          <tr>
            <td><strong>Uso:</strong></td>
            <td>${template.usageCount || 0} vezes</td>
          </tr>
        </table>
      </div>
      
      <div class="section">
        <h2>Itens de Verificação</h2>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Norma</th>
              <th>Categoria</th>
              <th>Obrigatório</th>
            </tr>
          </thead>
          <tbody>
            ${(template.items as any[]).map((item: any, index: number) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.item}</td>
                <td>${item.standard || '-'}</td>
                <td>${item.category || '-'}</td>
                <td>${item.isRequired ? 'Sim' : 'Não'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="footer">
        <p>Template exportado em ${new Date().toLocaleDateString('pt-BR')}</p>
        <p>COMPIA - Sistema Inteligente de Segurança do Trabalho</p>
      </div>
    </body>
    </html>
  `;
  }

  // Convert HTML to PDF (simplified - in production would use puppeteer or similar)
  return Buffer.from(html, 'utf-8');
}

// Excel Export functionality
export async function exportToExcel(data: any[], type: "inspections" | "action-plans" | "templates"): Promise<Buffer> {
  const rows = [];
  
  if (type === "inspections") {
    // Header row
    rows.push([
      "ID", "Título", "Descrição", "Local", "Data", "Status", 
      "Inspetor", "Conformidades", "Não Conformidades", "Recomendações"
    ]);
    
    // Data rows
    data.forEach((inspection: Inspection) => {
      const checklist = inspection.checklist as any[] || [];
      const findings = inspection.findings as any[] || [];
      const conformidades = checklist.filter(item => item.isCompliant).length;
      const naoConformidades = findings.length;
      
      rows.push([
        inspection.id,
        inspection.title,
        inspection.description || '',
        inspection.location,
        new Date(inspection.createdAt || '').toLocaleDateString('pt-BR'),
        translateStatus(inspection.status),
        inspection.inspectorId,
        conformidades,
        naoConformidades,
        inspection.recommendations || ''
      ]);
    });
  } else if (type === "action-plans") {
    // Header row
    rows.push([
      "ID", "Título", "Descrição", "Prioridade", "Status", 
      "Responsável", "Data Limite", "Criado em", "Concluído em"
    ]);
    
    // Data rows
    data.forEach((plan: ActionPlan) => {
      rows.push([
        plan.id,
        plan.title,
        plan.description || '',
        plan.priority,
        plan.status,
        plan.assigneeId,
        plan.dueDate ? new Date(plan.dueDate).toLocaleDateString('pt-BR') : '',
        new Date(plan.createdAt || '').toLocaleDateString('pt-BR'),
        plan.completedAt ? new Date(plan.completedAt).toLocaleDateString('pt-BR') : ''
      ]);
    });
  } else if (type === "templates") {
    // Header row
    rows.push([
      "ID", "Nome", "Descrição", "Categoria", "Total de Itens", 
      "Versão", "Uso", "Criado em", "Atualizado em"
    ]);
    
    // Data rows
    data.forEach((template: ChecklistTemplate) => {
      rows.push([
        template.id,
        template.name,
        template.description || '',
        template.category,
        (template.items as any[]).length,
        template.version || 1,
        template.usageCount || 0,
        new Date(template.createdAt || '').toLocaleDateString('pt-BR'),
        new Date(template.updatedAt || '').toLocaleDateString('pt-BR')
      ]);
    });
  }
  
  // Convert to CSV format (simplified Excel export)
  const csv = rows.map(row => row.map(cell => 
    typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
  ).join(',')).join('\n');
  
  return Buffer.from(csv, 'utf-8');
}

// Word Export functionality
export async function exportToWord(data: any, type: "inspection" | "action-plan"): Promise<Buffer> {
  let content = '';
  
  if (type === "inspection") {
    const inspection = data as Inspection;
    
    content = `
RELATÓRIO DE INSPEÇÃO DE SEGURANÇA

================================================================================

INFORMAÇÕES GERAIS
------------------
ID da Inspeção: ${inspection.id}
Título: ${inspection.title}
Local: ${inspection.location}
Data: ${new Date(inspection.createdAt || '').toLocaleDateString('pt-BR')}
Status: ${translateStatus(inspection.status)}
Inspetor: ${inspection.inspectorId}

DESCRIÇÃO
---------
${inspection.description || 'Sem descrição'}

CHECKLIST DE VERIFICAÇÃO
------------------------
${renderChecklistText(inspection.checklist as any[])}

${inspection.findings && (inspection.findings as any[]).length > 0 ? `
NÃO CONFORMIDADES ENCONTRADAS
-----------------------------
${renderFindingsText(inspection.findings as any[])}
` : ''}

${inspection.recommendations ? `
RECOMENDAÇÕES
-------------
${inspection.recommendations}
` : ''}

${inspection.aiAnalysis ? `
ANÁLISE DE INTELIGÊNCIA ARTIFICIAL
----------------------------------
${JSON.stringify(inspection.aiAnalysis, null, 2)}
` : ''}

================================================================================
Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
COMPIA - Sistema Inteligente de Segurança do Trabalho
    `;
  } else if (type === "action-plan") {
    const plan = data as ActionPlan;
    
    content = `
PLANO DE AÇÃO - METODOLOGIA 5W2H

================================================================================

INFORMAÇÕES GERAIS
------------------
ID do Plano: ${plan.id}
Título: ${plan.title}
Prioridade: ${plan.priority}
Status: ${plan.status}
Responsável: ${plan.assigneeId}

WHAT (O QUÊ)
------------
${plan.what}

WHY (POR QUÊ)
-------------
${plan.why}

WHERE (ONDE)
------------
${plan.where}

WHEN (QUANDO)
-------------
Data Limite: ${plan.dueDate ? new Date(plan.dueDate).toLocaleDateString('pt-BR') : 'Não definido'}
${plan.when}

WHO (QUEM)
----------
${plan.who}

HOW (COMO)
----------
${plan.how}

HOW MUCH (QUANTO)
-----------------
${plan.howMuch}

TAREFAS
-------
${(plan.tasks as any[] || []).map((task: any) => 
  `[ ${task.isCompleted ? 'X' : ' '} ] ${task.title}\n    ${task.description || ''}`
).join('\n\n')}

================================================================================
Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
COMPIA - Sistema Inteligente de Segurança do Trabalho
    `;
  }
  
  return Buffer.from(content, 'utf-8');
}

// Helper functions
function translateStatus(status: string): string {
  const translations: Record<string, string> = {
    draft: 'Rascunho',
    in_progress: 'Em Andamento',
    completed: 'Concluído',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
    pending: 'Pendente',
    overdue: 'Atrasado'
  };
  return translations[status] || status;
}

function renderChecklistItems(items: any[]): string {
  if (!items || items.length === 0) return '<tr><td colspan="4">Nenhum item no checklist</td></tr>';
  
  return items.map(item => `
    <tr>
      <td>${item.item}</td>
      <td>${item.standard || '-'}</td>
      <td>
        <span class="badge ${item.isCompliant ? 'low' : 'high'}">
          ${item.isCompliant ? 'Conforme' : 'Não Conforme'}
        </span>
      </td>
      <td>${item.notes || '-'}</td>
    </tr>
  `).join('');
}

function renderChecklistText(items: any[]): string {
  if (!items || items.length === 0) return 'Nenhum item no checklist';
  
  return items.map((item, index) => 
    `${index + 1}. ${item.item} (${item.standard || 'N/A'})
   Status: ${item.isCompliant ? 'CONFORME' : 'NÃO CONFORME'}
   Observações: ${item.notes || 'Sem observações'}`
  ).join('\n\n');
}

function renderFindings(findings: any[]): string {
  if (!findings || findings.length === 0) return '<tr><td colspan="4">Nenhuma não conformidade encontrada</td></tr>';
  
  return findings.map(finding => `
    <tr>
      <td>${finding.item}</td>
      <td>${finding.description}</td>
      <td><span class="badge ${finding.severity}">${finding.severity.toUpperCase()}</span></td>
      <td>${finding.standard || '-'}</td>
    </tr>
  `).join('');
}

function renderFindingsText(findings: any[]): string {
  if (!findings || findings.length === 0) return 'Nenhuma não conformidade encontrada';
  
  return findings.map((finding, index) => 
    `${index + 1}. ${finding.item}
   Descrição: ${finding.description}
   Severidade: ${finding.severity.toUpperCase()}
   Norma: ${finding.standard || 'N/A'}`
  ).join('\n\n');
}

function renderAIAnalysis(analysis: any): string {
  if (!analysis) return '<p>Análise não disponível</p>';
  
  return `
    <div class="metric-card">
      <div class="metric-value">${analysis.overallScore || 0}/100</div>
      <div class="metric-label">Pontuação Geral</div>
    </div>
    
    <h3>Nível de Risco: <span class="badge ${analysis.riskLevel}">${analysis.riskLevel?.toUpperCase()}</span></h3>
    
    ${analysis.insights && analysis.insights.length > 0 ? `
      <h3>Insights</h3>
      <ul>
        ${analysis.insights.map((insight: any) => 
          `<li><strong>${insight.title}</strong>: ${insight.description}</li>`
        ).join('')}
      </ul>
    ` : ''}
    
    ${analysis.recommendations && analysis.recommendations.length > 0 ? `
      <h3>Recomendações Prioritárias</h3>
      <ul>
        ${analysis.recommendations.map((rec: any) => 
          `<li>[${rec.priority.toUpperCase()}] ${rec.action} - Prazo: ${rec.deadline}</li>`
        ).join('')}
      </ul>
    ` : ''}
  `;
}