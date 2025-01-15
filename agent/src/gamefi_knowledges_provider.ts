import {
    Provider,
    IAgentRuntime,
    Memory,
    State,
    elizaLogger,
    embed,
    MemoryManager,
    formatMessages
} from "@ai16z/eliza";


const gameFiKnowledgesProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const recentMessagesData = state?.recentMessagesData?.slice(-10);
        const recentMessages = formatMessages({
            messages: recentMessagesData,
            actors: state?.actorsData,
        });
        return "+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++"
        const userEmbedding = await embed(runtime, message.content.text);

        const memoryManager = new MemoryManager({
            runtime,
            tableName: "GameFiKnowledges",
        });

        const relevantFacts = await memoryManager.searchMemoriesByEmbedding(
            userEmbedding,
            {count: 10}
        );


        // join the two and deduplicate
        const formattedFacts = relevantFacts.map((fact, index) => {
            return `${index + 1}. ${fact.content}`;
        }).join("\n");

        if (formattedFacts.length === 0) {
            return "";
        }

        return "Key facts that {{agentName}} knows:\n{{formattedFacts}}"
            .replace("{{agentName}}", runtime.character.name)
            .replace("{{formattedFacts}}", formattedFacts);
    },
};

export { gameFiKnowledgesProvider };
