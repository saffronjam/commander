package graph

// Resolver root wiring. The concrete resolver methods live in resolvers_*.go
// files in this package. NOTE: this project does NOT use gqlgen's follow-schema
// single-file resolver layout — `gqlgen generate` would re-stub every method
// here and collide with the resolvers_*.go files. After a schema change,
// regenerate generated.go/models_gen.go only (or hand-add the new resolver to a
// resolvers_*.go file).

// Mutation returns the MutationResolver implementation.
func (r *Resolver) Mutation() MutationResolver { return &mutationResolver{r} }

// Query returns the QueryResolver implementation.
func (r *Resolver) Query() QueryResolver { return &queryResolver{r} }

// Subscription returns the SubscriptionResolver implementation.
func (r *Resolver) Subscription() SubscriptionResolver { return &subscriptionResolver{r} }

type mutationResolver struct{ *Resolver }
type queryResolver struct{ *Resolver }
type subscriptionResolver struct{ *Resolver }
