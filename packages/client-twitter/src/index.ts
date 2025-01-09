import { TwitterPostClient } from "./post.ts";
import { TwitterSearchClient } from "./search.ts";
import { TwitterInteractionClient } from "./interactions.ts";
import {IAgentRuntime, Client, elizaLogger, Character} from "@ai16z/eliza";
import { validateTwitterConfig } from "./environment.ts";
import { ClientBase } from "./base.ts";

function isFalsish(input: any): boolean {
    // If the input is exactly NaN, return true
    if (Number.isNaN(input)) {
        return true;
    }

    // Convert input to a string if it's not null or undefined
    const value = input == null ? "" : String(input);

    // List of common falsish string representations
    const falsishValues = [
        "false",
        "0",
        "no",
        "n",
        "off",
        "null",
        "undefined",
        "",
    ];

    // Check if the value (trimmed and lowercased) is in the falsish list
    return falsishValues.includes(value.trim().toLowerCase());
}

function getSecret(character: Character, secret: string) {
    return character.settings?.secrets?.[secret] || process.env[secret];
}

class TwitterManager {
    client: ClientBase;
    post: TwitterPostClient;
    search: TwitterSearchClient;
    interaction: TwitterInteractionClient;
    constructor(runtime: IAgentRuntime, enableSearch:boolean) {
        this.client = new ClientBase(runtime);
        this.post = new TwitterPostClient(this.client, runtime);
        enableSearch = !isFalsish(getSecret(runtime.character, "TWITTER_SEARCH_ENABLE"));
        if (enableSearch) {
          // this searches topics from character file
          elizaLogger.warn('Twitter/X client running in a mode that:')
          elizaLogger.warn('1. violates consent of random users')
          elizaLogger.warn('2. burns your rate limit')
          elizaLogger.warn('3. can get your account banned')
          elizaLogger.warn('use at your own risk')
          this.search = new TwitterSearchClient(this.client, runtime); // don't start the search client by default
        }
        this.interaction = new TwitterInteractionClient(this.client, runtime);
    }
}

export const TwitterClientInterface: Client = {

    async start(runtime: IAgentRuntime) {
        await validateTwitterConfig(runtime);

        elizaLogger.log("Twitter client started");
        const enableSearch = !isFalsish(getSecret(runtime.character, "TWITTER_SEARCH_ENABLE"));
        // enableSearch is just set previous to this call
        // so enableSearch can change over time
        // and changing it won't stop the SearchClient in the existing instance
        const manager = new TwitterManager(runtime, enableSearch);

        await manager.client.init();

        await manager.post.start();

        await manager.interaction.start();
        if (enableSearch) {
            await manager.search.start();
        }

        return manager;
    },
    async stop(_runtime: IAgentRuntime) {
        elizaLogger.warn("Twitter client does not support stopping yet");
    },
};

export default TwitterClientInterface;
