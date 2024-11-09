import {
    errorDialogAttributes,
    genericRetriableErrorDialogAttributes,
} from "@/base/components/utils/dialog";
import type { ModalVisibilityProps } from "@/base/components/utils/modal";
import log from "@/base/log";
import { useUserDetailsSnapshot } from "@/new/photos/components/utils/use-snapshot";
import { useWrapAsyncOperation } from "@/new/photos/components/utils/use-wrap-async";
import type {
    Bonus,
    Plan,
    PlanPeriod,
    PlansData,
    Subscription,
} from "@/new/photos/services/user-details";
import {
    activateStripeSubscription,
    cancelStripeSubscription,
    getFamilyPortalRedirectURL,
    getPlansData,
    isSubscriptionActive,
    isSubscriptionActivePaid,
    isSubscriptionCancelled,
    isSubscriptionForPlan,
    isSubscriptionFree,
    isSubscriptionStripe,
    planUsage,
    redirectToCustomerPortal,
    redirectToPaymentsApp,
    userDetailsAddOnBonuses,
} from "@/new/photos/services/user-details";
import { useAppContext } from "@/new/photos/types/context";
import { bytesInGB, formattedStorageByteSize } from "@/new/photos/utils/units";
import { openURL } from "@/new/photos/utils/web";
import { ensure } from "@/utils/ensure";
import {
    FlexWrapper,
    FluidContainer,
    SpaceBetweenFlex,
} from "@ente/shared/components/Container";
import ArrowForward from "@mui/icons-material/ArrowForward";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Close from "@mui/icons-material/Close";
import Done from "@mui/icons-material/Done";
import {
    Button,
    type ButtonProps,
    Dialog,
    IconButton,
    Link,
    Stack,
    styled,
    ToggleButton,
    ToggleButtonGroup,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { t } from "i18next";
import React, { useCallback, useEffect, useState } from "react";
import { Trans } from "react-i18next";

type PlanSelectorProps = ModalVisibilityProps & {
    setLoading: (loading: boolean) => void;
};

export const PlanSelector: React.FC<PlanSelectorProps> = ({
    open,
    onClose,
    setLoading,
}) => {
    const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));

    if (!open) {
        return <></>;
    }

    return (
        <Dialog
            {...{ open, onClose, fullScreen }}
            PaperProps={{
                sx: (theme) => ({
                    width: { sm: "391px" },
                    p: 1,
                    [theme.breakpoints.down(360)]: { p: 0 },
                }),
            }}
        >
            <PlanSelectorCard {...{ onClose, setLoading }} />
        </Dialog>
    );
};

type PlanSelectorCardProps = Pick<PlanSelectorProps, "onClose" | "setLoading">;

const PlanSelectorCard: React.FC<PlanSelectorCardProps> = ({
    onClose,
    setLoading,
}) => {
    const { showMiniDialog } = useAppContext();

    const userDetails = useUserDetailsSnapshot();

    const [plansData, setPlansData] = useState<PlansData | undefined>();
    const [planPeriod, setPlanPeriod] = useState<PlanPeriod>(
        userDetails?.subscription.period ?? "month",
    );

    const usage = userDetails ? planUsage(userDetails) : 0;
    const subscription = userDetails?.subscription;
    const addOnBonuses = userDetails
        ? userDetailsAddOnBonuses(userDetails)
        : [];

    const togglePeriod = useCallback(
        () => setPlanPeriod((prev) => (prev == "month" ? "year" : "month")),
        [],
    );

    useEffect(() => {
        void (async () => {
            try {
                setLoading(true);
                const plansData = await getPlansData();
                const { plans } = plansData;
                if (subscription && isSubscriptionActive(subscription)) {
                    const activePlan = plans.find((plan) =>
                        isSubscriptionForPlan(subscription, plan),
                    );
                    if (!isSubscriptionFree(subscription) && !activePlan) {
                        plans.push({
                            id: subscription.productID,
                            storage: subscription.storage,
                            price: subscription.price,
                            period: subscription.period,
                            stripeID: subscription.productID,
                            iosID: subscription.productID,
                            androidID: subscription.productID,
                        });
                    }
                }
                setPlansData(plansData);
            } catch (e) {
                log.error("Failed to get plans", e);
                onClose();
                showMiniDialog(genericRetriableErrorDialogAttributes());
            } finally {
                setLoading(false);
            }
        })();
        // TODO
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePlanSelect = async (plan: Plan) => {
        switch (planSelectionOutcome(subscription)) {
            case "buyPlan":
                try {
                    setLoading(true);
                    await redirectToPaymentsApp(ensure(plan.stripeID), "buy");
                } catch (e) {
                    setLoading(false);
                    showMiniDialog(
                        errorDialogAttributes(
                            t("subscription_purchase_failed"),
                        ),
                    );
                }
                break;

            case "updateSubscriptionToPlan":
                showMiniDialog({
                    title: t("update_subscription_title"),
                    message: t("update_subscription_message"),
                    continue: {
                        text: t("update_subscription"),
                        action: () =>
                            redirectToPaymentsApp(
                                ensure(plan.stripeID),
                                "update",
                            ),
                    },
                });
                break;

            case "cancelOnMobile":
                showMiniDialog({
                    title: t("cancel_subscription_on_mobile"),
                    message: t("cancel_subscription_on_mobile_message"),
                    continue: {},
                    cancel: false,
                });
                break;

            case "contactSupport":
                showMiniDialog({
                    title: t("manage_plan"),
                    message: (
                        <Trans
                            i18nKey={"mail_to_manage_subscription"}
                            components={{
                                a: <Link href="mailto:support@ente.io" />,
                            }}
                            values={{ emailID: "support@ente.io" }}
                        />
                    ),
                    continue: {},
                    cancel: false,
                });
                break;
        }
    };

    const commonCardData = {
        onClose,
        setLoading,
        subscription,
        addOnBonuses,
        planPeriod,
        togglePeriod,
    };

    const plansList = (
        <Plans
            onClose={onClose}
            plansData={plansData}
            planPeriod={planPeriod}
            onPlanSelect={handlePlanSelect}
            subscription={subscription}
            hasAddOnBonus={addOnBonuses.length > 0}
        />
    );

    return (
        <Stack spacing={3} p={1.5}>
            {subscription && isSubscriptionActivePaid(subscription) ? (
                <PaidSubscriptionPlanSelectorCard
                    {...commonCardData}
                    usage={usage}
                >
                    {plansList}
                </PaidSubscriptionPlanSelectorCard>
            ) : (
                <FreeSubscriptionPlanSelectorCard {...commonCardData}>
                    {plansList}
                </FreeSubscriptionPlanSelectorCard>
            )}
        </Stack>
    );
};

/**
 * Return the outcome that should happen when the user selects a paid plan on
 * the plan selection screen.
 *
 * @param subscription Their current subscription details.
 */
const planSelectionOutcome = (subscription: Subscription | undefined) => {
    // This shouldn't happen, but we need this case to handle missing types.
    if (!subscription) return "buyPlan";

    // The user is a on a free plan and can buy the plan they selected.
    if (subscription.productID == "free") return "buyPlan";

    // Their existing subscription has expired. They can buy a new plan.
    if (subscription.expiryTime < Date.now() * 1000) return "buyPlan";

    // -- The user already has an active subscription to a paid plan.

    // Using Stripe.
    if (subscription.paymentProvider == "stripe") {
        // Update their existing subscription to the new plan.
        return "updateSubscriptionToPlan";
    }

    // Using one of the mobile app stores.
    if (
        subscription.paymentProvider == "appstore" ||
        subscription.paymentProvider == "playstore"
    ) {
        // They need to cancel first on the mobile app stores.
        return "cancelOnMobile";
    }

    // Some other bespoke case. They should contact support.
    return "contactSupport";
};

type FreeSubscriptionPlanSelectorCardProps = Pick<
    PlanSelectorProps,
    "onClose" | "setLoading"
> & {
    subscription: Subscription;
    addOnBonuses: Bonus[];
    planPeriod: PlanPeriod;
    togglePeriod: () => void;
};

const FreeSubscriptionPlanSelectorCard: React.FC<
    React.PropsWithChildren<FreeSubscriptionPlanSelectorCardProps>
> = ({
    onClose,
    setLoading,
    subscription,
    addOnBonuses,
    planPeriod,
    togglePeriod,
    children,
}) => (
    <>
        <Typography variant="h3" fontWeight={"bold"}>
            {t("choose_plan")}
        </Typography>
        <Box>
            <Stack spacing={3}>
                <Box>
                    <PeriodToggler
                        planPeriod={planPeriod}
                        togglePeriod={togglePeriod}
                    />
                    <Typography variant="small" mt={0.5} color="text.muted">
                        {t("two_months_free")}
                    </Typography>
                </Box>
                {children}
                {subscription && addOnBonuses.length > 0 && (
                    <>
                        <AddOnBonusRows addOnBonuses={addOnBonuses} />
                        <ManageSubscription
                            {...{ onClose, setLoading, subscription }}
                            hasAddOnBonus={true}
                        />
                    </>
                )}
            </Stack>
        </Box>
    </>
);

type PaidSubscriptionPlanSelectorCardProps =
    FreeSubscriptionPlanSelectorCardProps & {
        usage: number;
    };

const PaidSubscriptionPlanSelectorCard: React.FC<
    React.PropsWithChildren<PaidSubscriptionPlanSelectorCardProps>
> = ({
    onClose,
    setLoading,
    subscription,
    addOnBonuses,
    planPeriod,
    togglePeriod,
    usage,
    children,
}) => (
    <>
        <Box pl={1.5} py={0.5}>
            <SpaceBetweenFlex>
                <Box>
                    <Typography variant="h3" fontWeight={"bold"}>
                        {t("subscription")}
                    </Typography>
                    <Typography variant="small" color={"text.muted"}>
                        {bytesInGB(subscription.storage, 2)}{" "}
                        {t("storage_unit.gb")}
                    </Typography>
                </Box>
                <IconButton onClick={onClose} color="secondary">
                    <Close />
                </IconButton>
            </SpaceBetweenFlex>
        </Box>

        <Box px={1.5}>
            <Typography color={"text.muted"} fontWeight={"bold"}>
                <Trans
                    i18nKey="current_usage"
                    values={{
                        usage: `${bytesInGB(usage, 2)} ${t("storage_unit.gb")}`,
                    }}
                />
            </Typography>
        </Box>

        <Box>
            <Stack
                spacing={3}
                border={(theme) => `1px solid ${theme.palette.divider}`}
                p={1.5}
                borderRadius={(theme) => `${theme.shape.borderRadius}px`}
            >
                <Box>
                    <PeriodToggler
                        planPeriod={planPeriod}
                        togglePeriod={togglePeriod}
                    />
                    <Typography variant="small" mt={0.5} color="text.muted">
                        {t("two_months_free")}
                    </Typography>
                </Box>
                {children}
            </Stack>

            <Box py={1} px={1.5}>
                <Typography color={"text.muted"}>
                    {!isSubscriptionCancelled(subscription)
                        ? t("subscription_status_renewal_active", {
                              date: subscription.expiryTime,
                          })
                        : t("subscription_status_renewal_cancelled", {
                              date: subscription.expiryTime,
                          })}
                </Typography>
                {addOnBonuses.length > 0 && (
                    <AddOnBonusRows addOnBonuses={addOnBonuses} />
                )}
            </Box>
        </Box>

        <ManageSubscription
            onClose={onClose}
            setLoading={setLoading}
            subscription={subscription}
            hasAddOnBonus={addOnBonuses.length > 0}
        />
    </>
);

interface PeriodTogglerProps {
    planPeriod: PlanPeriod;
    togglePeriod: () => void;
}

const PeriodToggler: React.FC<PeriodTogglerProps> = ({
    planPeriod,
    togglePeriod,
}) => (
    <ToggleButtonGroup
        value={planPeriod}
        exclusive
        onChange={(_, newPeriod) => {
            if (newPeriod && newPeriod != planPeriod) togglePeriod();
        }}
        color="primary"
    >
        <CustomToggleButton value={"month"}>{t("monthly")}</CustomToggleButton>
        <CustomToggleButton value={"year"}>{t("yearly")}</CustomToggleButton>
    </ToggleButtonGroup>
);

const CustomToggleButton = styled(ToggleButton)(({ theme }) => ({
    textTransform: "none",
    padding: "12px 16px",
    borderRadius: "4px",
    backgroundColor: theme.colors.fill.faint,
    border: `1px solid transparent`,
    color: theme.colors.text.faint,
    "&.Mui-selected": {
        backgroundColor: theme.colors.accent.A500,
        color: theme.colors.text.base,
    },
    "&.Mui-selected:hover": {
        backgroundColor: theme.colors.accent.A500,
        color: theme.colors.text.base,
    },
    width: "97.433px",
}));

interface PlansProps {
    onClose: () => void;
    plansData: PlansData | undefined;
    planPeriod: PlanPeriod;
    subscription: Subscription;
    hasAddOnBonus: boolean;
    onPlanSelect: (plan: Plan) => void;
}

const Plans: React.FC<PlansProps> = ({
    onClose,
    plansData,
    planPeriod,
    subscription,
    hasAddOnBonus,
    onPlanSelect,
}) => {
    const { freePlan, plans } = plansData ?? {};
    return (
        <Stack spacing={2}>
            {plans
                ?.filter((plan) => plan.period === planPeriod)
                ?.map((plan) => (
                    <PlanRow
                        disabled={
                            subscription &&
                            isSubscriptionForPlan(subscription, plan)
                        }
                        popular={isPopularPlan(plan)}
                        key={plan.stripeID}
                        plan={plan}
                        subscription={subscription}
                        onPlanSelect={onPlanSelect}
                    />
                ))}
            {!(subscription && isSubscriptionActivePaid(subscription)) &&
                !hasAddOnBonus &&
                freePlan && (
                    <FreePlanRow onClose={onClose} storage={freePlan.storage} />
                )}
        </Stack>
    );
};

const isPopularPlan = (plan: Plan) =>
    plan.storage === 100 * 1024 * 1024 * 1024; /* 100 GB */

interface PlanRowProps {
    plan: Plan;
    subscription: Subscription;
    onPlanSelect: (plan: Plan) => void;
    disabled: boolean;
    popular: boolean;
}

const PlanRow: React.FC<PlanRowProps> = ({
    plan,
    subscription,
    onPlanSelect,
    disabled,
    popular,
}) => {
    const handleClick = () => !disabled && onPlanSelect(plan);

    const PlanButton = disabled ? DisabledPlanButton : ActivePlanButton;

    return (
        <PlanRowContainer>
            <TopAlignedFluidContainer>
                <Typography variant="h1" fontWeight={"bold"}>
                    {bytesInGB(plan.storage)}
                </Typography>
                <FlexWrapper flexWrap={"wrap"} gap={1}>
                    <Typography variant="h3" color="text.muted">
                        {t("storage_unit.gb")}
                    </Typography>
                    {popular &&
                        !(
                            subscription &&
                            isSubscriptionActivePaid(subscription)
                        ) && <Badge>{t("POPULAR")}</Badge>}
                </FlexWrapper>
            </TopAlignedFluidContainer>
            <Box width="136px">
                <PlanButton
                    sx={{
                        justifyContent: "flex-end",
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                    }}
                    size="large"
                    onClick={handleClick}
                >
                    <Box textAlign={"right"}>
                        <Typography fontWeight={"bold"} variant="large">
                            {plan.price}{" "}
                        </Typography>{" "}
                        <Typography color="text.muted" variant="small">
                            {`/ ${
                                plan.period === "month"
                                    ? t("month_short")
                                    : t("year")
                            }`}
                        </Typography>
                    </Box>
                </PlanButton>
            </Box>
        </PlanRowContainer>
    );
};

const PlanRowContainer = styled(FlexWrapper)(() => ({
    background:
        "linear-gradient(268.22deg, rgba(256, 256, 256, 0.08) -3.72%, rgba(256, 256, 256, 0) 85.73%)",
}));

const TopAlignedFluidContainer = styled(FluidContainer)`
    align-items: flex-start;
`;

const DisabledPlanButton = styled((props: ButtonProps) => (
    <Button disabled endIcon={<Done />} {...props} />
))(({ theme }) => ({
    "&.Mui-disabled": {
        backgroundColor: "transparent",
        color: theme.colors.text.base,
    },
}));

const ActivePlanButton = styled((props: ButtonProps) => (
    <Button color="accent" {...props} endIcon={<ArrowForward />} />
))(() => ({
    ".MuiButton-endIcon": {
        transition: "transform .2s ease-in-out",
    },
    "&:hover .MuiButton-endIcon": {
        transform: "translateX(4px)",
    },
}));

const Badge = styled(Box)(({ theme }) => ({
    borderRadius: theme.shape.borderRadius,
    padding: "2px 4px",
    backgroundColor: theme.colors.black.muted,
    backdropFilter: `blur(${theme.colors.blur.muted})`,
    color: theme.colors.white.base,
    textTransform: "uppercase",
    ...theme.typography.mini,
}));

interface FreePlanRowProps {
    onClose: () => void;
    storage: number;
}

const FreePlanRow: React.FC<FreePlanRowProps> = ({ onClose, storage }) => (
    <FreePlanRow_ onClick={onClose}>
        <Box>
            <Typography>{t("free_plan_option")}</Typography>
            <Typography variant="small" color="text.muted">
                {t("free_plan_description", {
                    storage: formattedStorageByteSize(storage),
                })}
            </Typography>
        </Box>
        <IconButton className={"endIcon"}>
            <ArrowForward />
        </IconButton>
    </FreePlanRow_>
);

const FreePlanRow_ = styled(SpaceBetweenFlex)(({ theme }) => ({
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 1),
    cursor: "pointer",
    "&:hover .endIcon": {
        backgroundColor: "rgba(255,255,255,0.08)",
    },
}));

interface AddOnBonusRowsProps {
    addOnBonuses: Bonus[];
}

const AddOnBonusRows: React.FC<AddOnBonusRowsProps> = ({ addOnBonuses }) => (
    <>
        {addOnBonuses.map((bonus, i) => (
            <Typography color="text.muted" key={i} sx={{ pt: 1 }}>
                <Trans
                    i18nKey={"add_on_valid_till"}
                    values={{
                        storage: formattedStorageByteSize(bonus.storage),
                        date: bonus.validTill,
                    }}
                />
            </Typography>
        ))}
    </>
);

type ManageSubscriptionProps = Pick<
    PlanSelectorProps,
    "onClose" | "setLoading"
> & {
    subscription: Subscription;
    hasAddOnBonus: boolean;
};

function ManageSubscription({
    onClose,
    setLoading,
    subscription,
    hasAddOnBonus,
}: ManageSubscriptionProps) {
    const { onGenericError } = useAppContext();

    const openFamilyPortal = async () => {
        setLoading(true);
        try {
            openURL(await getFamilyPortalRedirectURL());
        } catch (e) {
            onGenericError(e);
        }
        setLoading(false);
    };

    return (
        <Stack spacing={1}>
            {isSubscriptionStripe(subscription) && (
                <StripeSubscriptionOptions
                    {...{ onClose, subscription, hasAddOnBonus }}
                />
            )}
            <ManageSubscriptionButton
                color="secondary"
                onClick={openFamilyPortal}
            >
                {t("manage_family")}
            </ManageSubscriptionButton>
        </Stack>
    );
}

type StripeSubscriptionOptionsProps = Pick<PlanSelectorProps, "onClose"> & {
    subscription: Subscription;
    hasAddOnBonus: boolean;
};

const StripeSubscriptionOptions: React.FC<StripeSubscriptionOptionsProps> = ({
    onClose,
    subscription,
    hasAddOnBonus,
}) => {
    const { showMiniDialog } = useAppContext();

    const confirmReactivation = () =>
        showMiniDialog({
            title: t("reactivate_subscription"),
            message: t("reactivate_subscription_message", {
                date: subscription.expiryTime,
            }),
            continue: {
                text: t("reactivate_subscription"),
                action: async () => {
                    await activateStripeSubscription();
                    onClose();
                    // [Note: Chained MiniDialogs]
                    //
                    // The MiniDialog will automatically close when we the
                    // action promise resolves, so if we want to show another
                    // dialog, schedule it on the next run loop.
                    setTimeout(() => {
                        showMiniDialog({
                            title: t("success"),
                            message: t("subscription_activate_success"),
                            continue: { action: onClose },
                            cancel: false,
                        });
                    }, 0);
                },
            },
        });

    const confirmCancel = () =>
        showMiniDialog({
            title: t("cancel_subscription"),
            message: hasAddOnBonus ? (
                <Trans i18nKey={"cancel_subscription_with_addon_message"} />
            ) : (
                <Trans i18nKey={"cancel_subscription_message"} />
            ),
            continue: {
                text: t("cancel_subscription"),
                color: "critical",
                action: async () => {
                    await cancelStripeSubscription();
                    onClose();
                    // See: [Note: Chained MiniDialogs]
                    setTimeout(() => {
                        showMiniDialog({
                            message: t("subscription_cancel_success"),
                            cancel: t("ok"),
                        });
                    }, 0);
                },
            },
            cancel: t("nevermind"),
        });

    const handleManageClick = useWrapAsyncOperation(redirectToCustomerPortal);

    return (
        <>
            {isSubscriptionCancelled(subscription) ? (
                <ManageSubscriptionButton
                    color="secondary"
                    onClick={confirmReactivation}
                >
                    {t("reactivate_subscription")}
                </ManageSubscriptionButton>
            ) : (
                <ManageSubscriptionButton
                    color="secondary"
                    onClick={confirmCancel}
                >
                    {t("cancel_subscription")}
                </ManageSubscriptionButton>
            )}
            <ManageSubscriptionButton
                color="secondary"
                onClick={handleManageClick}
            >
                {t("manage_payment_method")}
            </ManageSubscriptionButton>
        </>
    );
};

const ManageSubscriptionButton: React.FC<ButtonProps> = ({
    children,
    ...props
}) => (
    <Button size="large" endIcon={<ChevronRight />} {...props}>
        <FluidContainer>{children}</FluidContainer>
    </Button>
);
