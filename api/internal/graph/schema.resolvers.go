package graph

// Resolver root wiring. The concrete resolver methods are hand-written in the
// resolvers_*.go files in this package, so gqlgen.yml deliberately omits the
// `resolver:` section — `just gqlgen` regenerates generated.go and
// models_gen.go only and never touches this file.

// Mutation returns the MutationResolver implementation.
func (r *Resolver) Mutation() MutationResolver { return &mutationResolver{r} }

// Query returns the QueryResolver implementation.
func (r *Resolver) Query() QueryResolver { return &queryResolver{r} }

// Subscription returns the SubscriptionResolver implementation.
func (r *Resolver) Subscription() SubscriptionResolver { return &subscriptionResolver{r} }

type mutationResolver struct{ *Resolver }
type queryResolver struct{ *Resolver }
type subscriptionResolver struct{ *Resolver }
