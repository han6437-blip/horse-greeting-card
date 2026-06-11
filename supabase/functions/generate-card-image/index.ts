// Supabase Edge Function: generate-card-image
// 调用阿里云百炼 wan2.7-image-pro 生成马年贺卡背景图
// 使用 DashScope 原生接口

const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY")!;
const DASHSCOPE_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!DASHSCOPE_API_KEY) {
      throw new Error("DASHSCOPE_API_KEY not configured in Supabase secrets");
    }

    const imagePrompt = `2026 Chinese New Year greeting card background, Year of the Horse (丙午马年).
Design requirements:
- Vertical 9:16 composition, traditional Chinese festive style
- Dominant colors: rich Chinese red (#C41E3A) and gold (#D4A017)
- Center element: a majestic galloping horse silhouette in gold, dynamic and powerful
- Surrounding decorations: red lanterns hanging from top, plum blossom branches on sides, auspicious clouds
- Background: festive red with subtle golden sparkle particles and firework bursts
- Bottom area: traditional Chinese pattern border
- Middle area: leave gentle empty space suitable for text overlay
- Style: elegant Chinese ink wash painting meets modern festive illustration
- NO text, NO characters, NO letters in the image — pure visual background only
- Warm, celebratory, family-oriented atmosphere`;

    // Step 1: Call DashScope to generate the image
    const genResponse = await fetch(DASHSCOPE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "wan2.7-image-pro",
        input: {
          messages: [
            {
              role: "user",
              content: [{ text: imagePrompt }],
            },
          ],
        },
        parameters: {
          size: "1080*1920",
          n: 1,
          watermark: false,
          thinking_mode: true,
        },
      }),
    });

    if (!genResponse.ok) {
      const errText = await genResponse.text();
      console.error("DashScope image gen error:", genResponse.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: `图片生成失败: ${genResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const genData = await genResponse.json();
    const imageUrl = genData?.output?.choices?.[0]?.message?.content?.[0]?.image;

    if (!imageUrl) {
      console.error("No image URL in response:", JSON.stringify(genData));
      return new Response(
        JSON.stringify({ success: false, error: "图片生成失败：未获取到图片URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 2: Download the image (URL expires in 24h)
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(imageBuffer)),
    );
    const dataUrl = `data:image/png;base64,${base64}`;

    return new Response(
      JSON.stringify({
        success: true,
        image: dataUrl,
        metadata: {
          size: "1080*1920",
          tokens: genData?.usage?.total_tokens || 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("generate-card-image error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
