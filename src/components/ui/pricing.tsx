"use client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { Truck, CheckCheck, Package, Headphones, Shield, User } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useRef, useState } from "react";

const plans = [
  {
    name: "Owner-Operator",
    description:
      "Everything a solo owner-operator needs to run lean and stay profitable",
    price: 9.99,
    yearlyPrice: 95.90,
    buttonText: "Start Free Trial",
    buttonVariant: "outline" as const,
    features: [
      { text: "1 truck, 1 driver (you)", icon: <User size={20} /> },
      { text: "Up to 20 orders/month", icon: <Package size={20} /> },
      { text: "Email support", icon: <Headphones size={20} /> },
    ],
    includes: [
      "Free includes:",
      "Basic dispatch board",
      "Order management",
      "Invoice generation",
      "Driver mobile app",
      "Expense tracking",
    ],
  },
  {
    name: "Starter",
    description:
      "Perfect for small carriers just getting started with digital dispatch",
    price: 49,
    yearlyPrice: 470,
    buttonText: "Start Free Trial",
    buttonVariant: "outline" as const,
    features: [
      { text: "Up to 50 orders/month", icon: <Package size={20} /> },
      { text: "5 trucks, 5 drivers", icon: <Truck size={20} /> },
      { text: "Email support", icon: <Headphones size={20} /> },
    ],
    includes: [
      "Free includes:",
      "Basic dispatch board",
      "Order management",
      "Driver mobile app",
      "Invoice generation",
      "Up to 2 team members",
    ],
  },
  {
    name: "Pro",
    description:
      "Best value for growing fleets that need advanced dispatch and analytics",
    price: 149,
    yearlyPrice: 1430,
    buttonText: "Start Free Trial",
    buttonVariant: "default" as const,
    popular: true,
    features: [
      { text: "Unlimited orders", icon: <Package size={20} /> },
      { text: "25 trucks, unlimited drivers", icon: <Truck size={20} /> },
      { text: "Priority support", icon: <Headphones size={20} /> },
    ],
    includes: [
      "Everything in Starter, plus:",
      "Kanban dispatch board",
      "Revenue analytics",
      "Broker management",
      "Automated invoicing",
      "Up to 10 team members",
    ],
  },
];

const PricingSwitch = ({
  onSwitch,
  className,
}: {
  onSwitch: (value: string) => void;
  className?: string;
}) => {
  const [selected, setSelected] = useState("0");

  const handleSwitch = (value: string) => {
    setSelected(value);
    onSwitch(value);
  };

  return (
    <div className={cn("flex justify-center", className)}>
      <div className="relative z-10 mx-auto flex w-fit rounded-xl border border-border bg-card p-1">
        <button
          onClick={() => handleSwitch("0")}
          className={cn(
            "relative z-10 w-fit cursor-pointer h-12 rounded-xl sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors sm:text-base text-sm",
            selected === "0"
              ? "text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {selected === "0" && (
            <motion.span
              layoutId="pricing-switch"
              className="absolute top-0 left-0 h-12 w-full rounded-xl border-2 border-brand bg-gradient-to-t from-[#ea5e1a] via-brand to-[#f59e0b]"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative">Monthly Billing</span>
        </button>

        <button
          onClick={() => handleSwitch("1")}
          className={cn(
            "relative z-10 w-fit cursor-pointer h-12 flex-shrink-0 rounded-xl sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors sm:text-base text-sm",
            selected === "1"
              ? "text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {selected === "1" && (
            <motion.span
              layoutId="pricing-switch"
              className="absolute top-0 left-0 h-12 w-full rounded-xl border-2 border-brand bg-gradient-to-t from-[#ea5e1a] via-brand to-[#f59e0b]"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            Yearly Billing
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-foreground">
              Save 20%
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);
  const pricingRef = useRef<HTMLDivElement>(null);

  const revealVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        delay: i * 0.4,
        duration: 0.5,
      },
    }),
    hidden: {
      filter: "blur(10px)",
      y: -20,
      opacity: 0,
    },
  };

  const togglePricingPeriod = (value: string) =>
    setIsYearly(Number.parseInt(value) === 1);

  return (
    <div
      className="px-4 py-20 sm:py-28 lg:py-32 max-w-7xl mx-auto relative"
      ref={pricingRef}
    >
      <article className="text-center mb-6 space-y-4 max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold sm:text-4xl lg:text-[2.75rem] text-foreground mb-4">
          <VerticalCutReveal
            splitBy="words"
            staggerDuration={0.15}
            staggerFrom="first"
            reverse={true}
            containerClassName="justify-center"
            transition={{
              type: "spring",
              stiffness: 250,
              damping: 40,
              delay: 0,
            }}
          >
            Simple pricing that scales with your fleet
          </VerticalCutReveal>
        </h2>

        <TimelineContent
          as="p"
          animationNum={0}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="md:text-base text-sm text-muted-foreground max-w-2xl mx-auto"
        >
          From solo owner-operators to 50-truck fleets. Plans that make sense
          for your size. Start free for 14 days, no credit card required.
        </TimelineContent>

        <TimelineContent
          as="div"
          animationNum={1}
          timelineRef={pricingRef}
          customVariants={revealVariants}
        >
          <PricingSwitch onSwitch={togglePricingPeriod} className="w-fit" />
        </TimelineContent>
      </article>

      <div className="grid md:grid-cols-3 gap-6 py-6">
        {plans.map((plan, index) => (
          <TimelineContent
            key={plan.name}
            as="div"
            animationNum={2 + index}
            timelineRef={pricingRef}
            customVariants={revealVariants}
          >
            <Card
              className={cn(
                "relative border rounded-2xl",
                plan.popular
                  ? "ring-2 ring-brand bg-brand/[0.04]"
                  : "border-border bg-card"
              )}
            >
              <CardHeader className="text-left">
                <div className="flex justify-between">
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {plan.name}
                  </h3>
                  {plan.popular && (
                    <div>
                      <span className="bg-brand text-white px-3 py-1 rounded-full text-sm font-semibold">
                        Popular
                      </span>
                    </div>
                  )}
                </div>
                <p className="xl:text-sm md:text-xs text-sm text-muted-foreground mb-4">
                  {plan.description}
                </p>
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-foreground">
                    $
                    <NumberFlow
                      format={{
                        currency: "USD",
                      }}
                      value={isYearly ? plan.yearlyPrice : plan.price}
                      className="text-4xl font-bold"
                    />
                  </span>
                  <span className="text-muted-foreground ml-1">
                    /{isYearly ? "year" : "month"}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <Link
                  href="/signup"
                  className={cn(
                    "flex items-center justify-center w-full mb-4 h-12 text-sm font-semibold rounded-xl transition-all",
                    plan.popular
                      ? "bg-gradient-to-t from-[#ea5e1a] to-brand border border-brand text-white hover:brightness-110"
                      : "bg-[#1f1f1f] text-white hover:bg-[#333]"
                  )}
                >
                  {plan.buttonText}
                </Link>

                <div className="space-y-3 pt-4 border-t border-border">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">
                    Features
                  </h2>
                  <h4 className="font-medium text-sm text-foreground mb-3">
                    {plan.includes[0]}
                  </h4>
                  <ul className="space-y-2.5">
                    {plan.includes.slice(1).map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <span className="h-5 w-5 bg-brand/10 border border-brand/30 rounded-full grid place-content-center mr-3 shrink-0">
                          <CheckCheck className="h-3 w-3 text-brand" />
                        </span>
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TimelineContent>
        ))}
      </div>
    </div>
  );
}
