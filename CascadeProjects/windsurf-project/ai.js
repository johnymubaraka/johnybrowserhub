const OpenAI = require("openai");

function getClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return null;
    }

    return new OpenAI({ apiKey });
}

async function askAI({ message, history = [], sources = [], attachments = [] }) {
    const client = getClient();
    if (!client) {
        return null;
    }

    const memoryBlock = history
        .slice(-8)
        .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
        .join("\n");

    const researchBlock = sources.length
        ? sources.map((item, index) => `${index + 1}. ${item.title}: ${item.snippet} (${item.url})`).join("\n")
        : "No external sources returned.";

    const attachmentBlock = attachments.length
        ? attachments.map((item) => `Attachment: ${item.name}\nDetails: ${item.extractedText || item.backendSummary || "No extraction"}`).join("\n\n")
        : "No attachments.";

    const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: "You are a desktop AI assistant similar to ChatGPT. Answer clearly, use research when available, cite links briefly, and preserve conversational context."
            },
            {
                role: "user",
                content: `Conversation memory:\n${memoryBlock || "No memory yet."}\n\nResearch results:\n${researchBlock}\n\nAttachments:\n${attachmentBlock}\n\nUser request:\n${message}`
            }
        ]
    });

    return response.choices[0]?.message?.content || null;
}

module.exports = {
    askAI
};