import { NextRequest, NextResponse } from 'next/server';
import { callGeminiAPI } from '@/utils/geminiApiCall';
import { generateToolsPrompt, executeTools, ToolCall } from '@/utils/tools';

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    let prompt = generateToolsPrompt() + '\n\nConversation:\n';
    
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg: { role: string; content: string }) => {
        prompt += `${msg.role}: ${msg.content}\n`;
      });
    }
    
    prompt += `User: ${message}\nAssistant:`;

    const initialResponse = await callGeminiAPI({
      prompt,
      temperature: 0.1, 
      maxTokens: 500,
    });

    try {
      let cleanedResponse = initialResponse.trim();
      
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      cleanedResponse = cleanedResponse.trim();
      
      if (cleanedResponse.startsWith('{') && cleanedResponse.includes('"type": "toolcall"')) {
        const toolCall: ToolCall = JSON.parse(cleanedResponse);
        
        if (toolCall.type === 'toolcall' && toolCall.toolname) {
          try {
            const toolResult = await executeTools(toolCall);
            
            const finalPrompt = `${prompt}

Tool was called: ${toolCall.toolname}
Tool result: ${JSON.stringify(toolResult, null, 2)}

Based on the tool result above, provide a helpful and natural response to the user's query. 

IMPORTANT: Only answer what the user specifically asked for. Be contextually aware`;

            const finalResponse = await callGeminiAPI({
              prompt: finalPrompt,
              temperature: 0.7,
              maxTokens: 1000,
            });

            return NextResponse.json({ 
              response: finalResponse,
              toolUsed: {
                name: toolCall.toolname,
                parameters: toolCall.parameters,
                result: toolResult
              }
            });
          } catch (toolError) {
            const errorPrompt = `${prompt}

Tool was called: ${toolCall.toolname}
Tool parameters: ${JSON.stringify(toolCall.parameters, null, 2)}
Tool execution failed with error: ${toolError instanceof Error ? toolError.message : 'Unknown error'}

The tool failed to execute. Please provide a helpful response explaining what went wrong and suggest alternatives. For example, if it's a location error, suggest using a more specific city name or checking the spelling.`;

            const errorResponse = await callGeminiAPI({
              prompt: errorPrompt,
              temperature: 0.7,
              maxTokens: 1000,
            });

            return NextResponse.json({ 
              response: errorResponse,
              toolUsed: {
                name: toolCall.toolname,
                parameters: toolCall.parameters,
                error: toolError instanceof Error ? toolError.message : 'Unknown error'
              }
            });
          }
        }
      }
    } catch (parseError) {
      console.log('Not a tool call, treating as regular response:', parseError);
    }

    return NextResponse.json({ response: initialResponse });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to get response from Gemini API' },
      { status: 500 }
    );
  }
}
