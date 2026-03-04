export function extractJSON(text: string): string {
  // Try to extract JSON from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  // Try to extract raw JSON object
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    return braceMatch[0];
  }
  return text;
}
