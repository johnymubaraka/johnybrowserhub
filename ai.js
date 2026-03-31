// Centralized Gemini-only AI integration.
// Removed: local LLM localhost calls, OpenAI/OpenRouter usage, and Cloudflare image generation.
// Added: one REST client for Gemini text, image generation, and image analysis.

const GEMINI_API_KEY = "AIzaSyBzF28EouRnGLvGkSJmAHK5fmM2zDMEF2A";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_TEXT_MODEL = "gemini-2.5-flash";
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const GEMINI_TIMEOUT_MS = 45000;
const MAX_CHAT_PROMPT_LENGTH = 2000;
const MAX_BASE64_CHARS = 8 * 1024 * 1024;

function buildAttachmentContext(attachments) {
    if (!Array.isArray(attachments) || attachments.length === 0) {
        return "";
    }

    return `\n\nAttached files for reference:\n${attachments.map((item, index) => {
        const details = item?.extractedText || item?.summary || item?.name || "Attachment";
        return `${index + 1}. ${item?.name || "Attachment"}\n${details}`;
    }).join("\n\n")}`;
}

function parseGeminiText(response) {
    const parts = response?.candidates?.[0]?.content?.parts || [];
    return parts
        .map((part) => part?.text || "")
        .filter(Boolean)
        .join("\n")
        .trim();
}

function parseGeminiImage(response) {
    const parts = response?.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
        const inlineData = part?.inlineData || part?.inline_data;
        if (!inlineData?.data) {
            continue;
        }

        const mimeType = inlineData.mimeType || inlineData.mime_type || "image/png";
        return `data:${mimeType};base64,${inlineData.data}`;
    }

    return "";
}

function parseDataUrl(dataUrl = "") {
    const match = `${dataUrl}`.match(/^data:(.+?);base64,(.+)$/);
    if (!match) {
        return null;
    }

    return {
        mimeType: match[1],
        data: match[2]
    };
}

async function postToGemini(model, payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
        const response = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": GEMINI_API_KEY
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error?.message || "Gemini request failed");
        }

        return data;
    } finally {
        clearTimeout(timeout);
    }
}

async function askAI(input) {
    try {
        const rawMessage = typeof input === "string" ? input : input?.message;
        const message = `${rawMessage || ""}`.trim().slice(0, MAX_CHAT_PROMPT_LENGTH);
        const attachmentContext = buildAttachmentContext(input?.attachments);

        if (!message) {
            return "Please type a message first.";
        }

        const response = await postToGemini(GEMINI_TEXT_MODEL, {
            systemInstruction: {
                parts: [{ text: "You are a helpful assistant." }]
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text: `${message}${attachmentContext}` }]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024
            }
        });

        return parseGeminiText(response) || "I could not generate a response.";
    } catch (error) {
        console.error("Gemini Chat Error:", error);
        return "⚠️ Gemini chat is unavailable right now. Please try again.";
    }
}

async function generateImage(prompt) {
    try {
        const safePrompt = `${prompt || ""}`.trim();
        if (!safePrompt) {
            return {
                success: false,
                error: "Prompt is required"
            };
        }

        const response = await postToGemini(GEMINI_IMAGE_MODEL, {
            contents: [
                {
                    role: "user",
                    parts: [{ text: safePrompt }]
                }
            ],
            generationConfig: {
                responseModalities: ["IMAGE"],
                imageConfig: {
                    aspectRatio: "1:1",
                    imageSize: "1K"
                }
            }
        });

        const image = parseGeminiImage(response);
        if (!image) {
            return {
                success: false,
                error: "Image generation failed"
            };
        }

        const base64Payload = image.startsWith("data:image/")
            ? image.split(",")[1] || ""
            : "";

        if (base64Payload.length > MAX_BASE64_CHARS) {
            return {
                success: false,
                error: "Generated image is too large"
            };
        }

        return {
            success: true,
            image,
            text: "Image generated with Gemini."
        };
    } catch (error) {
        console.error("Gemini Image Error:", error);
        return {
            success: false,
            error: "Image generation failed"
        };
    }
}

async function analyzeImage(imageDataUrl, prompt = "Analyze this image in detail.") {
    try {
        const parsed = parseDataUrl(imageDataUrl);
        if (!parsed) {
            return "⚠️ No image data provided.";
        }

        const response = await postToGemini(GEMINI_TEXT_MODEL, {
            systemInstruction: {
                parts: [{ text: "You analyze uploaded images carefully and explain what you observe." }]
            },
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: `${prompt}` },
                        {
                            inline_data: {
                                mime_type: parsed.mimeType,
                                data: parsed.data
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 1024
            }
        });

        return parseGeminiText(response) || "⚠️ No analysis returned.";
    } catch (error) {
        console.error("Gemini Image Analysis Error:", error);
        return "⚠️ Image analysis is unavailable right now.";
    }
}

module.exports = {
    askAI,
    generateImage,
    analyzeImage
};
