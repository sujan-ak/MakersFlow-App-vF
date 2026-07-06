import { Router, type IRouter } from "express";
import healthRouter from "./health";
import razorpayRouter from "./razorpay";

const router: IRouter = Router();

router.use(healthRouter);
router.use(razorpayRouter);

export default router;
