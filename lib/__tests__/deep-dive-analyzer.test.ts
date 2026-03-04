import { describe, it, expect, vi } from "vitest";

// Mock modules with side effects (OpenAI client instantiation, Supabase)
vi.mock("../llm", () => ({ callLLMWithTools: vi.fn() }));
vi.mock("../persistence", () => ({ persistDeepDive: vi.fn() }));

import { extractJSON } from "../text-utils";
import {
  parseSection,
  parseAIPatterns,
  parseDeepDiveResult,
  parseSummary,
  defaultSection,
  defaultAIPatterns,
} from "../deep-dive-analyzer";

// ── extractJSON ──────────────────────────────────────────────────

describe("extractJSON", () => {
  it("extracts JSON from markdown code fences with json tag", () => {
    const input = 'Some text\n```json\n{"key": "value"}\n```\nMore text';
    expect(extractJSON(input)).toBe('{"key": "value"}');
  });

  it("extracts JSON from markdown code fences without json tag", () => {
    const input = 'Prefix\n```\n{"a": 1}\n```\nSuffix';
    expect(extractJSON(input)).toBe('{"a": 1}');
  });

  it("extracts raw JSON object from surrounding text", () => {
    const input = 'Here is the result: {"name": "test", "count": 42} end';
    expect(extractJSON(input)).toBe('{"name": "test", "count": 42}');
  });

  it("returns original text when no JSON is found", () => {
    const input = "No JSON here at all";
    expect(extractJSON(input)).toBe("No JSON here at all");
  });

  it("extracts multiline JSON from fences", () => {
    const input = '```json\n{\n  "a": 1,\n  "b": 2\n}\n```';
    const result = extractJSON(input);
    expect(JSON.parse(result)).toEqual({ a: 1, b: 2 });
  });

  it("extracts the outermost braces for raw JSON", () => {
    const input = 'Result: {"outer": {"inner": true}}';
    const result = extractJSON(input);
    expect(JSON.parse(result)).toEqual({ outer: { inner: true } });
  });

  it("prefers fenced JSON over raw braces", () => {
    const input =
      'Before {"raw": true} middle ```json\n{"fenced": true}\n``` after';
    expect(extractJSON(input)).toBe('{"fenced": true}');
  });
});

// ── parseSection ─────────────────────────────────────────────────

describe("parseSection", () => {
  it("parses a valid section with all fields", () => {
    const input = {
      title: "What It Does",
      content: "A great project",
      confidence: "high",
      source: "readme",
    };
    const result = parseSection(input);
    expect(result).toEqual({
      title: "What It Does",
      content: "A great project",
      confidence: "high",
      source: "readme",
    });
  });

  it("parses a section without optional source field", () => {
    const input = {
      title: "Architecture",
      content: "Microservices pattern",
      confidence: "medium",
    };
    const result = parseSection(input);
    expect(result).toEqual({
      title: "Architecture",
      content: "Microservices pattern",
      confidence: "medium",
      source: undefined,
    });
  });

  it("returns defaults for null input", () => {
    const result = parseSection(null);
    expect(result).toEqual(defaultSection);
  });

  it("returns defaults for undefined input", () => {
    const result = parseSection(undefined);
    expect(result).toEqual(defaultSection);
  });

  it("returns defaults for non-object input (string)", () => {
    const result = parseSection("not an object");
    expect(result).toEqual(defaultSection);
  });

  it("returns defaults for non-object input (number)", () => {
    const result = parseSection(42);
    expect(result).toEqual(defaultSection);
  });

  it("uses default title when title is not a string", () => {
    const input = { title: 123, content: "Valid", confidence: "high" };
    expect(parseSection(input).title).toBe("Unknown");
  });

  it("uses default content when content is not a string", () => {
    const input = { title: "Valid", content: null, confidence: "high" };
    expect(parseSection(input).content).toBe(
      "Analysis could not determine this section."
    );
  });

  it("falls back to low confidence for invalid confidence value", () => {
    const input = {
      title: "Test",
      content: "Content",
      confidence: "extreme",
    };
    expect(parseSection(input).confidence).toBe("low");
  });

  it("falls back to low confidence when confidence is missing", () => {
    const input = { title: "Test", content: "Content" };
    expect(parseSection(input).confidence).toBe("low");
  });

  it("sets source to undefined when source is not a string", () => {
    const input = {
      title: "T",
      content: "C",
      confidence: "high",
      source: 42,
    };
    expect(parseSection(input).source).toBeUndefined();
  });

  it("returns a new object (not a reference to defaultSection)", () => {
    const result = parseSection(null);
    expect(result).not.toBe(defaultSection);
    expect(result).toEqual(defaultSection);
  });
});

// ── parseAIPatterns ──────────────────────────────────────────────

describe("parseAIPatterns", () => {
  it("parses valid input with all fields", () => {
    const input = {
      has_ai_components: true,
      sdks_detected: ["openai", "langchain"],
      agent_architecture: "tool_calling",
      skill_files: [".cursorrules"],
      mcp_usage: true,
      prompt_engineering: {
        has_system_prompts: true,
        has_few_shot: true,
        prompt_location: "src/prompts/",
      },
      confidence: "high",
      summary: "Uses OpenAI with tool calling pattern",
    };
    const result = parseAIPatterns(input);
    expect(result).toEqual(input);
  });

  it("returns defaults for null input", () => {
    const result = parseAIPatterns(null);
    expect(result).toEqual(defaultAIPatterns);
  });

  it("returns defaults for undefined input", () => {
    const result = parseAIPatterns(undefined);
    expect(result).toEqual(defaultAIPatterns);
  });

  it("returns defaults for non-object input", () => {
    const result = parseAIPatterns("string");
    expect(result).toEqual(defaultAIPatterns);
  });

  it("returns defaults for empty object", () => {
    const result = parseAIPatterns({});
    expect(result).toEqual({
      has_ai_components: false,
      sdks_detected: [],
      agent_architecture: null,
      skill_files: [],
      mcp_usage: false,
      prompt_engineering: {
        has_system_prompts: false,
        has_few_shot: false,
        prompt_location: null,
      },
      confidence: "low",
      summary: "Could not determine AI patterns.",
    });
  });

  it("filters non-string values from sdks_detected", () => {
    const input = { sdks_detected: ["openai", 42, null, "langchain"] };
    const result = parseAIPatterns(input);
    expect(result.sdks_detected).toEqual(["openai", "langchain"]);
  });

  it("filters non-string values from skill_files", () => {
    const input = { skill_files: [".cursorrules", 123, true] };
    const result = parseAIPatterns(input);
    expect(result.skill_files).toEqual([".cursorrules"]);
  });

  it("defaults sdks_detected to empty array when not an array", () => {
    const input = { sdks_detected: "openai" };
    const result = parseAIPatterns(input);
    expect(result.sdks_detected).toEqual([]);
  });

  it("defaults agent_architecture to null when not a string", () => {
    const input = { agent_architecture: 42 };
    const result = parseAIPatterns(input);
    expect(result.agent_architecture).toBeNull();
  });

  it("defaults mcp_usage to false when not a boolean", () => {
    const input = { mcp_usage: "yes" };
    const result = parseAIPatterns(input);
    expect(result.mcp_usage).toBe(false);
  });

  it("defaults prompt_engineering fields when prompt_engineering is missing", () => {
    const input = { has_ai_components: true };
    const result = parseAIPatterns(input);
    expect(result.prompt_engineering).toEqual({
      has_system_prompts: false,
      has_few_shot: false,
      prompt_location: null,
    });
  });

  it("defaults prompt_engineering sub-fields when they have wrong types", () => {
    const input = {
      prompt_engineering: {
        has_system_prompts: "yes",
        has_few_shot: 1,
        prompt_location: 42,
      },
    };
    const result = parseAIPatterns(input);
    expect(result.prompt_engineering).toEqual({
      has_system_prompts: false,
      has_few_shot: false,
      prompt_location: null,
    });
  });

  it("falls back to low confidence for invalid confidence value", () => {
    const input = { confidence: "extreme" };
    expect(parseAIPatterns(input).confidence).toBe("low");
  });

  it("uses default summary when summary is not a string", () => {
    const input = { summary: 42 };
    expect(parseAIPatterns(input).summary).toBe(
      "Could not determine AI patterns."
    );
  });

  it("returns a new object (not a reference to defaultAIPatterns)", () => {
    const result = parseAIPatterns(null);
    expect(result).not.toBe(defaultAIPatterns);
  });
});

// ── parseDeepDiveResult ──────────────────────────────────────────

describe("parseDeepDiveResult", () => {
  const repoUrl = "https://github.com/test/my-project";

  const validInput: Record<string, unknown> = {
    repo_url: "https://github.com/test/my-project",
    repo_name: "test/my-project",
    stars: 1500,
    contributors: 25,
    license: "MIT",
    primary_language: "TypeScript",
    last_updated: "2026-02-20",
    what_it_does: {
      title: "What It Does",
      content: "An awesome project",
      confidence: "high",
      source: "readme",
    },
    why_it_stands_out: {
      title: "Why It Stands Out",
      content: "Unique approach",
      confidence: "high",
      source: "analysis",
    },
    tech_stack: {
      languages: ["TypeScript", "Python"],
      frameworks: ["Next.js"],
      infrastructure: ["Docker"],
      key_dependencies: ["openai"],
      confidence: "high",
    },
    architecture: {
      title: "Architecture",
      content: "Monorepo with microservices",
      confidence: "medium",
      source: "code_analysis",
    },
    ai_patterns: {
      has_ai_components: true,
      sdks_detected: ["openai"],
      agent_architecture: "tool_calling",
      skill_files: [],
      mcp_usage: false,
      prompt_engineering: {
        has_system_prompts: true,
        has_few_shot: false,
        prompt_location: "src/prompts/",
      },
      confidence: "high",
      summary: "Tool calling agent",
    },
    skills_required: {
      technical: ["TypeScript", "React"],
      design: ["API Design"],
      domain: ["NLP"],
    },
    mode_specific: {
      title: "Key Insights",
      content: "Great for learning",
      confidence: "medium",
      source: "analysis",
    },
  };

  it("parses a complete valid input correctly", () => {
    const result = parseDeepDiveResult(validInput, repoUrl);

    expect(result.repo_url).toBe("https://github.com/test/my-project");
    expect(result.repo_name).toBe("test/my-project");
    expect(result.stars).toBe(1500);
    expect(result.contributors).toBe(25);
    expect(result.license).toBe("MIT");
    expect(result.primary_language).toBe("TypeScript");
    expect(result.last_updated).toBe("2026-02-20");
    expect(result.what_it_does.content).toBe("An awesome project");
    expect(result.why_it_stands_out.confidence).toBe("high");
    expect(result.tech_stack.languages).toEqual(["TypeScript", "Python"]);
    expect(result.tech_stack.frameworks).toEqual(["Next.js"]);
    expect(result.tech_stack.infrastructure).toEqual(["Docker"]);
    expect(result.tech_stack.key_dependencies).toEqual(["openai"]);
    expect(result.tech_stack.confidence).toBe("high");
    expect(result.architecture.content).toBe("Monorepo with microservices");
    expect(result.ai_patterns.has_ai_components).toBe(true);
    expect(result.ai_patterns.agent_architecture).toBe("tool_calling");
    expect(result.skills_required.technical).toEqual(["TypeScript", "React"]);
    expect(result.skills_required.design).toEqual(["API Design"]);
    expect(result.skills_required.domain).toEqual(["NLP"]);
    expect(result.mode_specific.content).toBe("Great for learning");
  });

  it("uses repoUrl fallback when repo_url is missing", () => {
    const input = { ...validInput, repo_url: undefined };
    const result = parseDeepDiveResult(
      input as Record<string, unknown>,
      repoUrl
    );
    expect(result.repo_url).toBe(repoUrl);
  });

  it("derives repo_name from repoUrl when repo_name is missing", () => {
    const input = { ...validInput, repo_name: undefined };
    const result = parseDeepDiveResult(
      input as Record<string, unknown>,
      repoUrl
    );
    expect(result.repo_name).toBe("test/my-project");
  });

  it("defaults stars to 0 when not a number", () => {
    const input = { ...validInput, stars: "many" };
    const result = parseDeepDiveResult(
      input as Record<string, unknown>,
      repoUrl
    );
    expect(result.stars).toBe(0);
  });

  it("defaults contributors to null when not a number", () => {
    const input = { ...validInput, contributors: "some" };
    const result = parseDeepDiveResult(
      input as Record<string, unknown>,
      repoUrl
    );
    expect(result.contributors).toBeNull();
  });

  it("defaults license to Unknown when not a string", () => {
    const input = { ...validInput, license: null };
    const result = parseDeepDiveResult(
      input as Record<string, unknown>,
      repoUrl
    );
    expect(result.license).toBe("Unknown");
  });

  it("defaults primary_language to Unknown when not a string", () => {
    const input = { ...validInput, primary_language: 42 };
    const result = parseDeepDiveResult(
      input as Record<string, unknown>,
      repoUrl
    );
    expect(result.primary_language).toBe("Unknown");
  });

  it("generates last_updated as today when not a string", () => {
    const input = { ...validInput, last_updated: null };
    const result = parseDeepDiveResult(
      input as Record<string, unknown>,
      repoUrl
    );
    // Should be a date string like "2026-03-04"
    expect(result.last_updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("handles minimal input with sensible defaults", () => {
    const minimalInput: Record<string, unknown> = {};
    const result = parseDeepDiveResult(minimalInput, repoUrl);

    expect(result.repo_url).toBe(repoUrl);
    expect(result.repo_name).toBe("test/my-project");
    expect(result.stars).toBe(0);
    expect(result.contributors).toBeNull();
    expect(result.license).toBe("Unknown");
    expect(result.primary_language).toBe("Unknown");
    expect(result.last_updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Sections should be defaults
    expect(result.what_it_does.confidence).toBe("low");
    expect(result.why_it_stands_out.confidence).toBe("low");
    expect(result.architecture.confidence).toBe("low");
    expect(result.mode_specific.confidence).toBe("low");

    // Tech stack arrays should be empty
    expect(result.tech_stack.languages).toEqual([]);
    expect(result.tech_stack.frameworks).toEqual([]);
    expect(result.tech_stack.infrastructure).toEqual([]);
    expect(result.tech_stack.key_dependencies).toEqual([]);
    expect(result.tech_stack.confidence).toBe("low");

    // AI patterns should be defaults
    expect(result.ai_patterns.has_ai_components).toBe(false);
    expect(result.ai_patterns.sdks_detected).toEqual([]);

    // Skills should be empty
    expect(result.skills_required.technical).toEqual([]);
    expect(result.skills_required.design).toEqual([]);
    expect(result.skills_required.domain).toEqual([]);
  });

  it("filters non-string values from tech_stack arrays", () => {
    const input = {
      ...validInput,
      tech_stack: {
        languages: ["TypeScript", 42, null],
        frameworks: [true, "React"],
        infrastructure: ["Docker", undefined],
        key_dependencies: [123],
        confidence: "high",
      },
    };
    const result = parseDeepDiveResult(
      input as Record<string, unknown>,
      repoUrl
    );
    expect(result.tech_stack.languages).toEqual(["TypeScript"]);
    expect(result.tech_stack.frameworks).toEqual(["React"]);
    expect(result.tech_stack.infrastructure).toEqual(["Docker"]);
    expect(result.tech_stack.key_dependencies).toEqual([]);
  });

  it("filters non-string values from skills_required arrays", () => {
    const input = {
      ...validInput,
      skills_required: {
        technical: ["TS", 42],
        design: [null, "UX"],
        domain: [true],
      },
    };
    const result = parseDeepDiveResult(
      input as Record<string, unknown>,
      repoUrl
    );
    expect(result.skills_required.technical).toEqual(["TS"]);
    expect(result.skills_required.design).toEqual(["UX"]);
    expect(result.skills_required.domain).toEqual([]);
  });

  it("defaults tech_stack confidence to low for invalid value", () => {
    const input = {
      ...validInput,
      tech_stack: {
        languages: [],
        frameworks: [],
        infrastructure: [],
        key_dependencies: [],
        confidence: "super",
      },
    };
    const result = parseDeepDiveResult(
      input as Record<string, unknown>,
      repoUrl
    );
    expect(result.tech_stack.confidence).toBe("low");
  });

  it("handles missing tech_stack entirely", () => {
    const input = { ...validInput, tech_stack: undefined };
    const result = parseDeepDiveResult(
      input as Record<string, unknown>,
      repoUrl
    );
    expect(result.tech_stack.languages).toEqual([]);
    expect(result.tech_stack.confidence).toBe("low");
  });

  it("handles missing skills_required entirely", () => {
    const input = { ...validInput, skills_required: undefined };
    const result = parseDeepDiveResult(
      input as Record<string, unknown>,
      repoUrl
    );
    expect(result.skills_required.technical).toEqual([]);
    expect(result.skills_required.design).toEqual([]);
    expect(result.skills_required.domain).toEqual([]);
  });
});

// ── parseSummary ─────────────────────────────────────────────────

describe("parseSummary", () => {
  const validInput: Record<string, unknown> = {
    takeaways: [
      "Strong TypeScript ecosystem",
      "AI tools are maturing",
      "Gaps in testing infrastructure",
    ],
    recommendations: {
      learning: {
        repo: "test/learn-project",
        reason: "Best documentation and examples",
      },
      building: {
        repo: "test/build-project",
        reason: "Most production-ready architecture",
      },
      scouting: {
        insight: "Market moving towards agent-based architectures",
      },
    },
    skills_roadmap: [
      "Learn TypeScript",
      "Master React patterns",
      "Explore AI SDKs",
    ],
    gaps_discovered: [
      "No good testing framework for agents",
      "Lack of standard MCP tooling",
    ],
    ai_ecosystem_notes:
      "OpenAI SDK dominates, LangChain popular for complex chains",
  };

  it("parses a complete valid input correctly", () => {
    const result = parseSummary(validInput);

    expect(result.takeaways).toHaveLength(3);
    expect(result.takeaways[0]).toBe("Strong TypeScript ecosystem");
    expect(result.recommendations.learning).toEqual({
      repo: "test/learn-project",
      reason: "Best documentation and examples",
    });
    expect(result.recommendations.building).toEqual({
      repo: "test/build-project",
      reason: "Most production-ready architecture",
    });
    expect(result.recommendations.scouting).toEqual({
      insight: "Market moving towards agent-based architectures",
    });
    expect(result.skills_roadmap).toHaveLength(3);
    expect(result.gaps_discovered).toHaveLength(2);
    expect(result.ai_ecosystem_notes).toBe(
      "OpenAI SDK dominates, LangChain popular for complex chains"
    );
  });

  it("defaults takeaways to empty array when missing", () => {
    const result = parseSummary({});
    expect(result.takeaways).toEqual([]);
  });

  it("filters non-string values from takeaways", () => {
    const result = parseSummary({ takeaways: ["valid", 42, null, "also valid"] });
    expect(result.takeaways).toEqual(["valid", "also valid"]);
  });

  it("defaults takeaways to empty array when not an array", () => {
    const result = parseSummary({ takeaways: "not an array" });
    expect(result.takeaways).toEqual([]);
  });

  it("defaults recommendations to undefined when missing", () => {
    const result = parseSummary({});
    expect(result.recommendations.learning).toBeUndefined();
    expect(result.recommendations.building).toBeUndefined();
    expect(result.recommendations.scouting).toBeUndefined();
  });

  it("defaults learning recommendation when repo or reason is not a string", () => {
    const result = parseSummary({
      recommendations: {
        learning: { repo: 42, reason: "valid" },
      },
    });
    expect(result.recommendations.learning).toBeUndefined();
  });

  it("defaults building recommendation when repo or reason is not a string", () => {
    const result = parseSummary({
      recommendations: {
        building: { repo: "valid", reason: null },
      },
    });
    expect(result.recommendations.building).toBeUndefined();
  });

  it("defaults scouting recommendation when insight is not a string", () => {
    const result = parseSummary({
      recommendations: {
        scouting: { insight: 42 },
      },
    });
    expect(result.recommendations.scouting).toBeUndefined();
  });

  it("defaults skills_roadmap to empty array when missing", () => {
    const result = parseSummary({});
    expect(result.skills_roadmap).toEqual([]);
  });

  it("filters non-string values from skills_roadmap", () => {
    const result = parseSummary({
      skills_roadmap: ["Learn TS", 42, "Learn React"],
    });
    expect(result.skills_roadmap).toEqual(["Learn TS", "Learn React"]);
  });

  it("defaults gaps_discovered to empty array when missing", () => {
    const result = parseSummary({});
    expect(result.gaps_discovered).toEqual([]);
  });

  it("filters non-string values from gaps_discovered", () => {
    const result = parseSummary({
      gaps_discovered: ["Gap 1", null, "Gap 2"],
    });
    expect(result.gaps_discovered).toEqual(["Gap 1", "Gap 2"]);
  });

  it("defaults ai_ecosystem_notes to empty string when missing", () => {
    const result = parseSummary({});
    expect(result.ai_ecosystem_notes).toBe("");
  });

  it("defaults ai_ecosystem_notes to empty string when not a string", () => {
    const result = parseSummary({ ai_ecosystem_notes: 42 });
    expect(result.ai_ecosystem_notes).toBe("");
  });

  it("handles completely empty input with all defaults", () => {
    const result = parseSummary({});
    expect(result).toEqual({
      takeaways: [],
      recommendations: {
        learning: undefined,
        building: undefined,
        scouting: undefined,
      },
      skills_roadmap: [],
      gaps_discovered: [],
      ai_ecosystem_notes: "",
    });
  });
});
