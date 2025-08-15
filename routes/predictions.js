const express = require('express');

const router = express.Router();

// Get AI command predictions using OpenRouter
router.post('/', express.json(), async (req, res) => {
    try {
        const { currentCommand, context, workingDirectory, operatingSystem, commandLineScreen, previousCommands } = req.body;
        
        if (!currentCommand || typeof currentCommand !== 'string') {
            return res.status(400).json({ error: 'Current command is required' });
        }

        // Get OpenAI settings from environment variables
        const apiKey = process.env.OPENAI_API_KEY;
        const model = process.env.OPENAI_MODEL ;
        const baseUrl = process.env.OPENAI_BASE_URL ;

        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        // Build context for AI prediction
        let prompt = `You are a command-line expert. Based on the current input, command line screen, and context, suggest 3 likely shell commands the user might want to run next.

Current input: "${currentCommand}"`;

        if (operatingSystem && typeof operatingSystem === 'string') {
            prompt += `\nOperating System: ${operatingSystem}`;
        }

        if (commandLineScreen && typeof commandLineScreen === 'string') {
            prompt += `\nCurrent command line screen:\n${commandLineScreen}`;
        }

        if (previousCommands && Array.isArray(previousCommands) && previousCommands.length > 0) {
            prompt += `\nPreviously typed commands:\n${previousCommands.slice(-10).join('\n')}`;
        }

        if (context && typeof context === 'string') {
            prompt += `\nRecent commands context:\n${context}`;
        }

        if (workingDirectory && typeof workingDirectory === 'string') {
            prompt += `\nWorking directory: ${workingDirectory}`;
        }

        prompt += `

Respond with exactly 3 command suggestions in JSON format:
{
  "suggestions": ["command1", "command2", "command3"]
}

Rules:
- Only suggest valid shell commands
- Consider the current input as potentially incomplete
- Suggestions should be practical and commonly used
- Keep commands concise and executable
- No explanations, just the JSON response`;

        // Make request to OpenAI API
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 200,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API error:', response.status, errorText);
            return res.status(500).json({ error: 'AI service unavailable' });
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Unexpected API response format:', data);
            return res.status(500).json({ error: 'Invalid AI response format' });
        }

        let suggestions = [];
        try {
            const content = data.choices[0].message.content.trim();
            const parsed = JSON.parse(content);
            suggestions = parsed.suggestions || [];
        } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            // Try to extract suggestions from text format as fallback
            const content = data.choices[0].message.content;
            const lines = content.split('\n').filter(line => line.trim());
            suggestions = lines.slice(0, 3).map(line => line.replace(/^[0-9\.\-\*\s]+/, '').trim());
        }

        // Ensure we have exactly 3 suggestions
        while (suggestions.length < 3) {
            suggestions.push(`${currentCommand} --help`);
        }
        suggestions = suggestions.slice(0, 3);

        res.json({ suggestions });

    } catch (error) {
        console.error('Error generating predictions:', error);
        res.status(500).json({ error: 'Failed to generate predictions' });
    }
});

module.exports = router;