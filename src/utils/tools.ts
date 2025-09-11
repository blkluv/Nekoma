export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCall {
  type: "toolcall";
  toolname: string;
  parameters?: Record<string, unknown>;
}

// Import transfer functionality
import { getServerWalletForUser } from "./cdp";
import { getFullUserSpendPermissions, FullSpendPermission } from "./spendUtils";

export const availableTools: Tool[] = [
  {
    name: "sendUSDCTransaction",
    description: "Send USDC tokens to another wallet address on the Base network. Use this tool when users want to transfer, send, or pay USDC to someone. This tool integrates with the user's spend permissions system and will trigger client-side execution for proper permission handling.",
    parameters: {
      type: "object",
      properties: {
        recipient: {
          type: "string",
          description: "The wallet address to send USDC to (must be a valid Ethereum address starting with 0x)"
        },
        amount: {
          type: "string", 
          description: "Amount of USDC to send in smallest units (6 decimals). For example, '1000000' = 1 USDC, '500000' = 0.5 USDC"
        },
        amountUSD: {
          type: "number",
          description: "Amount in USD for user-friendly display (e.g., 1.5 for $1.50)"
        },
        userAddress: {
          type: "string",
          description: "The user's wallet address (automatically populated from session if not provided)"
        },
        permission: {
          type: "object",
          description: "Optional: Full spend permission object with signature to use for this transaction. If provided, this specific permission will be used instead of fetching permissions."
        }
      },
      required: ["recipient", "amount", "amountUSD"]
    }
  },
  {
    name: "convertUSDToUSDC",
    description: "Convert USD amount to USDC token units (6 decimals). Use this when you need to calculate USDC amounts for transactions.",
    parameters: {
      type: "object",
      properties: {
        usdAmount: {
          type: "number",
          description: "Amount in USD (e.g., 1.5 for $1.50)"
        }
      },
      required: ["usdAmount"]
    }
  },
  {
    name: "getUserSpendPermissionsWithSignatures",
    description: "Get complete spend permission objects with signatures for a user. Use this when you need full permission details including signatures for transactions.",
    parameters: {
      type: "object",
      properties: {
        userAddress: {
          type: "string",
          description: "The user's wallet address"
        },
        spenderAddress: {
          type: "string", 
          description: "The spender's wallet address (smart account address)"
        }
      },
      required: ["userAddress", "spenderAddress"]
    }
  }
];

export async function executeTools(toolCall: any): Promise<any> {
  console.log('executeTools called with:', JSON.stringify(toolCall, null, 2));
  
  try {
    const { toolname, parameters } = toolCall;
    
    console.log('Tool name:', toolname);
    console.log('Tool parameters:', JSON.stringify(parameters, null, 2));

    switch (toolname) {
      case 'sendUSDCTransaction':
        console.log('Executing sendUSDCTransaction...');
        return await sendUSDCTransaction(parameters);
        
      case 'convertUSDToUSDC':
        console.log('Executing convertUSDToUSDC...');
        return await convertUSDToUSDC(parameters);
        
      case 'getUserSpendPermissionsWithSignatures':
        console.log('Executing getUserSpendPermissionsWithSignatures...');
        return await getUserSpendPermissionsWithSignatures(parameters);
        
      default:
        console.error('Unknown tool:', toolname);
        throw new Error(`Unknown tool: ${toolname}`);
    }
  } catch (error) {
    console.error('executeTools error:', error);
    throw error;
  }
}

interface SendUSDCParams {
  recipient: string;
  amount: string;
  amountUSD: number;
  userAddress?: string; // Optional: can be provided for authenticated operations
  permission?: FullSpendPermission; // Optional: specific permission to use
}

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function sendUSDCTransaction(params: SendUSDCParams): Promise<unknown> {
  console.log('sendUSDCTransaction called with params:', JSON.stringify(params, null, 2));
  
  try {
    const { recipient, amount, amountUSD, userAddress } = params;

    console.log('Validating parameters...');

    // Validate recipient address
    if (!recipient || !recipient.startsWith('0x') || recipient.length !== 42) {
      console.error('Invalid recipient address:', recipient);
      throw new Error('Invalid recipient address. Must be a valid Ethereum address starting with 0x');
    }

    // Validate amount
    const amountBigInt = BigInt(amount);
    if (amountBigInt <= 0) {
      console.error('Invalid amount:', amount);
      throw new Error('Amount must be greater than 0');
    }

    console.log('Parameters validated');

    // Check if we have user authentication
    if (!userAddress) {
      console.log('No user address provided');
      return {
        success: false,
        requiresAuth: true,
        message: "USDC transfer requires user authentication",
        instructions: [
          "Please connect your wallet to the application first"
        ]
      };
    }

    console.log('User address found:', userAddress);

    // Get server wallet for this user
    const serverWallet = getServerWalletForUser(userAddress);
    if (!serverWallet?.smartAccount) {
      console.error('Server wallet not found for user:', userAddress);
      return {
        success: false,
        requiresSetup: true,
        message: "Server wallet not found. Please refresh and try again."
      };
    }

    console.log('Server wallet found:', serverWallet.smartAccount.address);

    // Return transaction parameters for client-side execution
    const result = {
      success: false,
      executeClientSide: true,
      message: `Preparing to send $${amountUSD} USDC to ${recipient}...`,
      transactionParams: {
        recipient,
        amount,
        amountUSD,
        userAddress,
        smartAccountAddress: serverWallet.smartAccount.address
      }
    };

    console.log('Returning client-side execution parameters:', JSON.stringify(result, null, 2));
    
    return result;

  } catch (error) {
    console.error('sendUSDCTransaction error:', error);
    throw new Error(`USDC transfer preparation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function convertUSDToUSDC(usdAmount: number): unknown {
  try {
    if (usdAmount <= 0) {
      throw new Error('USD amount must be greater than 0');
    }

    // USDC has 6 decimals
    const usdcAmount = Math.floor(usdAmount * 1_000_000);
    
    return {
      usdAmount,
      usdcAmount: usdcAmount.toString(),
      usdcAmountFormatted: `${usdAmount.toFixed(6)} USDC`,
      decimals: 6,
      calculation: `${usdAmount} USD = ${usdcAmount} USDC units (${usdAmount} * 10^6)`
    };
  } catch (error) {
    console.error('USD to USDC conversion error:', error);
    throw new Error(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

interface GetPermissionsParams {
  userAddress: string;
  spenderAddress: string;
}

async function getUserSpendPermissionsWithSignatures(params: GetPermissionsParams): Promise<unknown> {
  try {
    const { userAddress, spenderAddress } = params;

    if (!userAddress || !spenderAddress) {
      throw new Error('User address and spender address are required');
    }

    const fullPermissions = await getFullUserSpendPermissions(userAddress, spenderAddress);
    
    return {
      success: true,
      permissions: fullPermissions,
      count: fullPermissions.length,
      message: `Found ${fullPermissions.length} spend permission(s) with full details and signatures`,
      details: {
        userAddress,
        spenderAddress,
        token: "USDC",
        network: "Base"
      }
    };
  } catch (error) {
    console.error('Failed to get spend permissions with signatures:', error);
    return {
      success: false,
      permissions: [],
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch spend permissions'
    };
  }
}

export function generateToolsPrompt(): string {
  const toolsDescription = availableTools.map(tool => 
    `- ${tool.name}: ${tool.description}\n  Parameters: ${JSON.stringify(tool.parameters, null, 2)}`
  ).join('\n\n');

  return `You have access to the following tools:

${toolsDescription}

When a user asks something that requires using one of these tools, respond with a JSON object in this exact format:
{
  "type": "toolcall",
  "toolname": "tool_name_here",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}

If the user's query doesn't require any tools, respond normally with a conversational answer.

Important: 
- Only respond with the JSON toolcall format when you need to use a tool
- DO NOT wrap the JSON in markdown code blocks (no code formatting)
- Return ONLY the raw JSON object, nothing else
- Make sure the JSON is valid and properly formatted
- Include all required parameters for the tool
- If no tools are needed, respond conversationally

Note: When tools provide data, be contextually aware of what the user specifically asked for:
- If they ask for "temperature", only mention temperature
- If they ask for "weather", you can provide broader weather information
- If they ask "is it raining", focus on precipitation
- Always be concise and answer only what was requested`;
}
