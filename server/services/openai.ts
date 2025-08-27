import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export interface SafetyAnalysisResult {
  riskLevel: "low" | "medium" | "high" | "critical";
  confidence: number;
  findings: Array<{
    category: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    recommendation: string;
    standard?: string;
  }>;
  summary: string;
  priorityActions: string[];
}

export async function analyzeInspectionFindings(
  inspectionData: {
    title: string;
    location: string;
    checklist?: any[];
    findings?: any[];
    description?: string;
  }
): Promise<SafetyAnalysisResult> {
  try {
    const prompt = `
    Você é um especialista em segurança do trabalho brasileiro com profundo conhecimento das Normas Regulamentadoras (NRs) do Ministério do Trabalho.

    Analise os dados de inspeção abaixo e forneça uma análise detalhada em JSON:

    DADOS DA INSPEÇÃO:
    - Título: ${inspectionData.title}
    - Local: ${inspectionData.location}
    - Descrição: ${inspectionData.description || "Não informada"}
    - Checklist: ${JSON.stringify(inspectionData.checklist || [])}
    - Não conformidades: ${JSON.stringify(inspectionData.findings || [])}

    Responda APENAS com um JSON no seguinte formato:
    {
      "riskLevel": "low|medium|high|critical",
      "confidence": 0.95,
      "findings": [
        {
          "category": "Equipamentos de Proteção",
          "description": "Descrição específica da não conformidade",
          "severity": "high",
          "recommendation": "Ação específica recomendada",
          "standard": "NR-06"
        }
      ],
      "summary": "Resumo executivo da análise",
      "priorityActions": ["Ação prioritária 1", "Ação prioritária 2"]
    }

    IMPORTANTE:
    - Identifique violações de NRs específicas quando aplicável
    - Classifique riscos conforme gravidade e urgência
    - Priorize ações que evitem acidentes imediatos
    - Use linguagem técnica apropriada
    - Seja específico nas recomendações
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em segurança do trabalho brasileiro. Analise dados de inspeção e forneça insights baseados nas NRs."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 1
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      riskLevel: result.riskLevel || "medium",
      confidence: Math.max(0, Math.min(1, result.confidence || 0.8)),
      findings: result.findings || [],
      summary: result.summary || "Análise não disponível",
      priorityActions: result.priorityActions || []
    };

  } catch (error) {
    console.error("Error analyzing inspection findings:", error);
    throw new Error("Falha na análise de IA: " + (error as Error).message);
  }
}

export async function generateActionPlanRecommendations(
  finding: {
    description: string;
    severity: string;
    location: string;
    standard?: string;
  }
): Promise<{
  what: string;
  why: string;
  where: string;
  when: string;
  who: string;
  how: string;
  howMuch: string;
}> {
  try {
    const prompt = `
    Como especialista em segurança do trabalho, crie um plano de ação 5W2H para a seguinte não conformidade:

    DESCRIÇÃO: ${finding.description}
    SEVERIDADE: ${finding.severity}
    LOCAL: ${finding.location}
    NORMA: ${finding.standard || "Não especificada"}

    Responda APENAS com JSON no formato:
    {
      "what": "O que deve ser feito (ação específica)",
      "why": "Por que é necessário (justificativa técnica e legal)",
      "where": "Onde será executado (local específico)",
      "when": "Quando deve ser feito (prazo baseado na severidade)",
      "who": "Quem é responsável (cargo/função)",
      "how": "Como será executado (metodologia detalhada)",
      "howMuch": "Quanto custará (estimativa de recursos)"
    }

    Baseie-se nas NRs brasileiras e boas práticas de SST.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em segurança do trabalho. Crie planos de ação 5W2H detalhados e práticos."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 1
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      what: result.what || "Ação não especificada",
      why: result.why || "Justificativa não especificada", 
      where: result.where || finding.location,
      when: result.when || "Prazo a definir",
      who: result.who || "Responsável a definir",
      how: result.how || "Metodologia a definir",
      howMuch: result.howMuch || "Custo a estimar"
    };

  } catch (error) {
    console.error("Error generating action plan:", error);
    throw new Error("Falha na geração do plano de ação: " + (error as Error).message);
  }
}

export async function generateComplianceInsights(
  organizationData: {
    inspections: number;
    nonCompliances: number;
    completedActions: number;
    period: string;
  }
): Promise<Array<{
  type: "pattern" | "trend" | "recommendation";
  title: string;
  description: string;
  confidence: number;
}>> {
  try {
    const prompt = `
    Analise os dados de conformidade abaixo e gere insights de IA para gestão de segurança:

    DADOS DA ORGANIZAÇÃO:
    - Inspeções realizadas: ${organizationData.inspections}
    - Não conformidades: ${organizationData.nonCompliances}
    - Ações concluídas: ${organizationData.completedActions}
    - Período: ${organizationData.period}

    Responda APENAS com JSON no formato:
    {
      "insights": [
        {
          "type": "pattern|trend|recommendation",
          "title": "Título do insight",
          "description": "Descrição detalhada do insight",
          "confidence": 0.85
        }
      ]
    }

    Identifique padrões, tendências preocupantes e recomendações estratégicas.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "Você é um analista de dados de segurança do trabalho. Gere insights estratégicos baseados em dados."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 1
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return result.insights || [];

  } catch (error) {
    console.error("Error generating compliance insights:", error);
    throw new Error("Falha na geração de insights: " + (error as Error).message);
  }
}
