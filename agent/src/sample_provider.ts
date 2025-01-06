import {db} from "../db.ts";
import {elizaLogger, IAgentRuntime, Memory, Provider, State} from "@ai16z/eliza";
import {extract} from '@extractus/article-extractor';
import {readFileSync, writeFileSync, existsSync} from "fs";
import {resolve} from "path";

const MANUAL_NEWS_PATH = resolve("manual_news.txt");
const API_ENDPOINT = 'https://cryptonews-api.com/api/v1';
const TICKERS = ['BEAM', 'BTC', 'FLOKI', 'SAND', 'GALA', 'IMX', 'AXS', 'MANA', 'ENJ', 'ILV', 'ALICE', 'YGG', 'UOS', 'WAXP'];
const TIMEFRAME_HOURS = 24;

export const myProvider: Provider = {
        get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
            try {
                const API_KEY = process.env.CRYPTONEWS_API_KEY;
                if (!API_KEY) {
                    elizaLogger.warn("No CRYPTONEWS_API_KEY configured. newsProvider returning empty.");
                    return '\n\n#Today News:\nNo news found';
                }
                const url = `${API_ENDPOINT}?section=general&items=10&tickers=${TICKERS.join(',')}&token=${API_KEY}`;
                const response = await fetch(url);
                const data = await response.json();

                if (!data || !data.data || data.data.length === 0) {
                    elizaLogger.log("No news retrieved from cryptonews-api");
                    return '\n\n#Today News:\nNo news found';

                }

                const checkStmt = db.prepare(`SELECT url, processed_at, parse_status
                                              FROM processed_news
                                              WHERE url = ?`);
                const insertStmt = db.prepare(`INSERT INTO processed_news (url, processed_at, parse_status)
                                               VALUES (?, ?, ?)`);
                const updateStmt = db.prepare(`UPDATE processed_news
                                               SET parse_status = ?
                                               WHERE url = ?`);

                for (const article of data.data) {
                    const existing = checkStmt.get(article.news_url);

                    if (!existing) {
                        // Not processed in the last day (or ever)
                        // Attempt to parse full text:
                        let fullText = "";
                        let parseStatus = "failed";
                        try {
                            const parsed = await extract(article.news_url);
                            if (parsed && parsed.content) {
                                fullText = parsed.content.trim();
                                parseStatus = "success";
                            }
                        } catch (parseErr) {
                            elizaLogger.error(`Parsing failed for ${article.news_url}:`, parseErr);
                        }

                        // Insert into processed_news table
                        insertStmt.run(article.news_url, new Date().toISOString(), parseStatus);

                        // If parse failed, we still return something?
                        // The requirement says if it can't parse, just mark processed but no text
                        // so in that case, we just skip and continue to the next article
                        if (parseStatus === "failed") {
                            elizaLogger.log(`Article parse failed, marked as processed: ${article.news_url}`);
                            // Move on to the next article
                            continue;
                        }

                        // If successful, we have full_text now
                        const ticker = article.tickers && article.tickers.length > 0 ? article.tickers[0] : "Unknown";
                        const title = article.title || "No Title";
                        const snippet = article.text || "No snippet available";
                        const publishedAt = article.date || "Unknown date";
                        const newsUrl = article.news_url;

                        // Provide a brief context chunk
                        // We have full text, but might be long. Just show a snippet or first few lines in context.
                        const shortExtract = fullText.split('\n').slice(0, 3).join('\n') + '...'; // a short snippet from the full text

                        // The context we provide to the agent
                        const contextContent = `**${ticker} News**: ${title}\nShort Snippet:\n${shortExtract}\nPublished at: ${publishedAt}\nSource: ${newsUrl}`;

                        elizaLogger.log(`Providing new article context: ${title} (${newsUrl})`);
                        return `\n\n#Today News:\n${contextContent}`;
                    } else {
                        // Already processed - skip
                        continue;
                    }
                }

                // If we get here, all articles are processed or failed parse
                elizaLogger.log("All retrieved articles have been processed or failed parsing. No new context to provide.");
                return await getManualNews();

            } catch (error) {
                elizaLogger.error("Error in newsProvider:", error);
                return '\n\n#Today News:\nNo news found';
            }
        },
    }
;



async function getManualNews() {
    try {
        if (!existsSync(MANUAL_NEWS_PATH)) {
            elizaLogger.log(`File not found: ${MANUAL_NEWS_PATH}. Creating a new one.`);
            writeFileSync(MANUAL_NEWS_PATH, "");
        }

        const manualNews = readFileSync(MANUAL_NEWS_PATH, "utf-8").trim();
        if (!manualNews) {
            elizaLogger.log(`manual_news.txt is empty. Clearing file: ${MANUAL_NEWS_PATH}`);
            writeFileSync(MANUAL_NEWS_PATH, ""); // Clear the file
            return '\n\n#Today News:\nNo news found';
        }

        elizaLogger.log(`Providing news from manual_news.txt at path: ${MANUAL_NEWS_PATH}`);
        writeFileSync(MANUAL_NEWS_PATH, ""); // Clear the file after reading
        return `\n\n#Today News:\n${manualNews}`;
    } catch (err) {
        elizaLogger.error(`Failed to read manual_news.txt at path ${MANUAL_NEWS_PATH}:`, err);
        return '\n\n#Today News:\nNo news found';
    }
}
