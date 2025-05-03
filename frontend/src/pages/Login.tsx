import LoginForm from "@/components/Login/LoginForm";

const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">S.I.M.P</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access your S.I.M.P
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
};

export default Login;
