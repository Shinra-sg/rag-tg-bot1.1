export async function askLLM(prompt: string, model = "bloomz"): Promise<string> {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          stop: ["<|im_end|>"]
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Ollama API error:", response.status, errText);
      throw new Error(`Ollama API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    console.log("Ollama raw response:", data);
    let answer = data.response?.trim();
    if (!answer) {
      console.error("Ollama: поле response отсутствует", data);
      return "Не удалось получить ответ от ИИ.";
    }
    // Удаляем размышления <think>...</think>
    answer = answer.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    return answer || "Не удалось получить ответ от ИИ.";
  } catch (e) {
    console.error("Ошибка при обращении к Ollama:", e);
    throw e;
  }
}
    