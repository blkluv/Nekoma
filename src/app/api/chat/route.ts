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

    // Get user address from session
    let userAddress: string | undefined;
    try {
      const session = request.cookies.get("session")?.value;
      if (session) {
        const statusResponse = await fetch(`${request.nextUrl.origin}/api/auth/status`, {
          headers: {
            Cookie: `session=${session}`
          }
        });
        const statusData = await statusResponse.json();
        if (statusData.isAuthenticated) {
          userAddress = statusData.address;
        }
      }
    } catch (err) {
      console.log('Could not get user address from session:', err);
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

    console.log('🔍 Raw Gemini response:', initialResponse);

    try {
      let cleanedResponse = initialResponse.trim();
      
      console.log('🧹 Before cleaning:', JSON.stringify(cleanedResponse));
      
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      cleanedResponse = cleanedResponse.trim();
      
      console.log('🧹 After cleaning:', JSON.stringify(cleanedResponse));
      console.log('🔍 Checking if starts with { and contains toolcall:', 
        cleanedResponse.startsWith('{'), 
        cleanedResponse.includes('"type": "toolcall"')
      );
      
      if (cleanedResponse.startsWith('{') && cleanedResponse.includes('"type": "toolcall"')) {
        console.log('Detected tool call! Parsing JSON...');
        
        const toolCall: ToolCall = JSON.parse(cleanedResponse);
        
        console.log('Parsed tool call:', JSON.stringify(toolCall, null, 2));
        
        if (toolCall.type === 'toolcall' && toolCall.toolname) {
          console.log('Valid tool call structure, executing tool:', toolCall.toolname);
          
          try {
            // Add user address to tool parameters if not already provided
            if (toolCall.toolname === 'sendUSDCTransaction' && userAddress && !toolCall.parameters?.userAddress) {
              console.log('Adding user address to tool parameters:', userAddress);
              toolCall.parameters = { ...toolCall.parameters, userAddress };
            }

            console.log('Executing tool with parameters:', JSON.stringify(toolCall.parameters, null, 2));
            
            const toolResult = await executeTools(toolCall);
            
            console.log('Tool execution result:', JSON.stringify(toolResult, null, 2));
            
            // Check if the tool requires client-side execution
            if (toolResult && typeof toolResult === 'object' && 
                (toolResult as any).executeClientSide) {
              
              console.log('Tool requires client-side execution, returning special response');
              
              // Return the tool result directly so the frontend can handle it
              return NextResponse.json({ 
                response: (toolResult as any).message,
                toolUsed: {
                  name: toolCall.toolname,
                  parameters: toolCall.parameters,
                  result: toolResult
                },
                executeClientSide: true,
                transactionParams: (toolResult as any).transactionParams
              });
            }

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
