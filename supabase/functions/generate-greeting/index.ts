// Supabase Edge Function: generate-greeting
// 调用阿里云百炼 qwen3.7-max 生成马年新春贺词
// 使用 OpenAI 兼容接口

import "jsr:@std/dotenv/load";

const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY")!;
const BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!DASHSCOPE_API_KEY) {
      throw new Error("DASHSCOPE_API_KEY not configured in Supabase secrets");
    }

    const systemPrompt = `你是一位中国传统春节祝福语创作大师，专精于马年（丙午年）贺词创作。2026年是丙午马年。

创作要求：
1. 融入马年吉祥意象：骏马奔腾、马到成功、龙马精神、一马当先、春风得意马蹄疾等
2. 语言温馨喜庆，适合送给家人长辈
3. 字数控制在60-120字之间
4. 结构：先用一两句有文采的诗句开篇，再送上朴实温暖的祝福
5. 可适当使用 emoji 装饰（如 🐴🏮🧧🎊✨），但不要过度
6. 每次生成尽量不同，保持多样性

输出格式：直接输出贺词文本，不需要"这是为您创作的贺词"之类的引导语。`;

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen3.7-max",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "请帮我创作一段2026丙午马年春节祝福贺词，送给家人长辈。" },
        ],
        temperature: 0.9,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("DashScope API error:", response.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: `贺词生成失败: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const greeting = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({
        success: true,
        greeting: greeting.trim(),
        metadata: {
          tokens: data.usage?.total_tokens || 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("generate-greeting error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
