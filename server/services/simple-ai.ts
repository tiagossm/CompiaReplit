import OpenAI from 'openai';

let openai: OpenAI | null = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY 
  });
}

export class SimpleAIService {
  async chatResponse(message: string): Promise<string> {
    if (!openai) {
      throw new Error('OpenAI não configurado');
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em segurança do trabalho e normas regulamentadoras brasileiras. Responda de forma clara e objetiva.'
        },
        {
          role: 'user', 
          content: message
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    return response.choices[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';
  }

  async generateChecklist(prompt: string): Promise<any> {
    if (!openai) {
      throw new Error('OpenAI não configurado');
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Gere um checklist de segurança do trabalho em formato JSON com a estrutura: { items: [{ type: string, label: string, description: string, required: boolean, options?: string[] }] }'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Falha na geração');
    
    return JSON.parse(content);
  }
}

export const simpleAI = new SimpleAIService();