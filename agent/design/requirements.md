Now that you understand this project, read @/agent/requirements.md  and then create an agent/bootstrap-related-project.md which documents enough context for another agent to start building the related project from scratch.

---

Requirements:
- Multi-tenant support. The server will have access to a `user_id` field which uniquely identifies a user.

This `user_id` acts as a search filter. Only documents with the exact `user_id` may be searched,
retrieved, GraphQL queried. Documents can only be created in the `user_id` space.

Document the standing document schema in `.yaml`. The related app will make modifications to this,
but for now document it the same way.

The key change is multi-tenancy.

The project will be called `remember-mcp`. 

The tool set will be:
- `remember_create_memory`
- `remember_update_memory`
- `remember_delete_memory`
- `remember_search_memory` 
- `remember_find_similar`
- `remember_create_relationship`
- `remember_update_relationship`
- `remember_search_relationship`
- `remember_delete_relationship`
- `remember_query_memory` - Support direct GraphQL queries of the Weaviate instance

What operations do `search-index` and `ask-index` map to?

Memories will have a `weight` score from `0 - 1`, which determines the weight/significance
of the memory. This influences which memories receive priority.

The memories will track `location` in two methods, full address of current location and GPSs 
coordinates. This can be used to enhance search to find memories based on the location they were created.

Memories will have a `trust` score from `0 - 1`, which represents the level of trust required for a 
caller to be able to access a memory. For instance, `0` means the memory cannot be retrieved directly,
but it is possible to intimate information about the memory. `1` means full trust, and the memory can be 
retrieved directly. This is designed to support a future enhancement where MCP clients with a different 
`user_id` that are properly authenticated and have proper authorization to interact with other user's
memories on the basis of their trust level respective to the `user_id` whose memories are being accessed.
This is designed to support a feature where one user can chat with another user's agent, but the user 
agent only exposes information if they trust the other user. The agent will track a memory
rating the trust of the caller user. The agent will update the trust memory with context as to why
it trusts this user or does not trust this user.

Memories may track relationships between memories. This is three fold:
- Relationship memory tracks IDs of connected memories
- Connected memories track IDs of relationships
- Relationships may bind 2 ... N memories in a single relationship
- Relationships include an observation about the connection
  
Each entity will track a `context` property. The `context` defines the context in which the memory 
was created. The context is information about the conversation that generated the memory.