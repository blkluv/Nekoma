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

export const availableTools: Tool[] = [
  {
    name: "getWeatherDetails",
    description: "Get current weather information for a specific location. Use this tool when users ask about temperature, weather conditions, humidity, wind, or any weather-related information for a city.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City name or location (e.g., 'New York', 'London', 'Hyderabad')"
        }
      },
      required: ["location"]
    }
  },
  {
    name: "getCurrentTime",
    description: "Get the current time and date",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "calculateMath",
    description: "Perform mathematical calculations",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Mathematical expression to calculate (e.g., '2 + 2', '10 * 5')"
        }
      },
      required: ["expression"]
    }
  }
];

export async function executeTools(toolCall: ToolCall): Promise<unknown> {
  switch (toolCall.toolname) {
    case "getWeatherDetails":
      return await getWeatherDetails(toolCall.parameters?.location as string);
    
    case "getCurrentTime":
      return getCurrentTime();
    
    case "calculateMath":
      return calculateMath(toolCall.parameters?.expression as string);
    
    default:
      throw new Error(`Unknown tool: ${toolCall.toolname}`);
  }
}

async function getWeatherDetails(location: string): Promise<unknown> {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new Error("OpenWeather API key not configured");
    }

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Location "${location}" not found. Please check the spelling or try a more specific city name (e.g., "Hyderabad, India" instead of "hyd")`);
      }
      if (response.status === 401) {
        throw new Error("Weather API authentication failed. Please check the API key configuration.");
      }
      throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.log('Fetched weather data for', data.name);

    return {
      location: data.name,
      country: data.sys.country,
      temperature: data.main.temp,
      feelsLike: data.main.feels_like,
      humidity: data.main.humidity,
      description: data.weather[0].description,
      windSpeed: data.wind.speed,
      pressure: data.main.pressure
    };
  } catch (error) {
    throw error; 
  }
}

function getCurrentTime(): unknown {
  const now = new Date();
  return {
    currentTime: now.toLocaleTimeString(),
    currentDate: now.toLocaleDateString(),
    timestamp: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

function calculateMath(expression: string): unknown {
  try {
    const result = Function(`"use strict"; return (${expression})`)();
    return {
      expression,
      result,
      type: typeof result
    };
  } catch (error) {
    console.error('Math calculation error:', error);
    throw new Error(`Invalid mathematical expression: ${expression}`);
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
