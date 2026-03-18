import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from '@workos-inc/authkit-react';
import { Authenticated, Unauthenticated } from 'convex/react';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

function RouteComponent() {
  const { user, signIn, signOut } = useAuth();

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1>Convex + AuthKit</h1>
        <button onClick={() => (user ? signOut() : void signIn())}>
          {user ? 'Sign out' : 'Sign in'}
        </button>
      </div>
      <Authenticated>
        <Content />
      </Authenticated>
      <Unauthenticated>
        <p>Please sign in to view data</p>
      </Unauthenticated>
    </div>
  );
}

function Content() {
  return <div>Welcome</div>;
}
