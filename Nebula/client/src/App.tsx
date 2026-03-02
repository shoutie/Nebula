import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import WalletContextProvider from "@/lib/wallet";
import Game from "@/pages/Game";
import Coinflip from "@/pages/Coinflip";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Game} />
      <Route path="/coinflip" component={Coinflip} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WalletContextProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </WalletContextProvider>
  );
}

export default App;
