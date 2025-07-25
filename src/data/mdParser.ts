import fs from "fs/promises";
import unified = require("unified");
import remarkParse = require("remark-parse");
const visit = require("unist-util-visit");

export async function parseMarkdown(filePath: string): Promise<string[]> {
  const raw = await fs.readFile(filePath, "utf-8");
  const processor = unified().use(remarkParse as any);
  const tree = processor.parse(raw);

  const texts: string[] = [];

  visit(tree, "text", (node: any) => {
    if (node.value) {
      texts.push(node.value);
    }
  });

  return texts.filter(line => line.trim().length > 0);
}