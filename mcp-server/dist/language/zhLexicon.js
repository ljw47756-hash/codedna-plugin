import { containsAny } from "../tools/common.js";
export const zhFeatureHints = [
    "添加",
    "新增",
    "创建",
    "生成",
    "实现",
    "支持",
    "修复",
    "优化",
    "重构",
    "更新",
    "检查",
    "审查",
    "扫描",
    "保存",
    "上传",
    "安装",
    "启用",
    "解析",
    "迁移",
    "替换",
    "换成",
    "进入",
    "完善",
    "补",
    "方案",
    "指导",
    "排查",
    "注册",
    "打包",
    "发布",
    "部署",
    "文档",
    "说明",
    "任务包",
    "报告",
    "测试计划",
    "回归"
];
export const zhConstraintHints = [
    "不要",
    "别",
    "不再",
    "不许",
    "不能",
    "不用",
    "不得",
    "禁止",
    "避免",
    "只允许",
    "只做",
    "只改",
    "只能",
    "仅",
    "必须",
    "务必",
    "一定要",
    "保留",
    "不要改",
    "不要修改",
    "不要提交",
    "不要上传",
    "不要继续",
    "不要缩减",
    "先不要",
    "先不用",
    "除非",
    "等待我说",
    "等我说",
    "不要再",
    "不允许",
    "不可",
    "不能公开",
    "不要公开",
    "不要暴露",
    "别暴露",
    "防止抄袭",
    "避免抄袭",
    "不要泄露",
    "范围内",
    "不能动",
    "不要动",
    "不大改"
];
export const zhPreferenceHints = [
    "偏好",
    "风格",
    "简单",
    "简洁",
    "清晰",
    "一致",
    "紧凑",
    "可读",
    "用中文",
    "用英文",
    "中文描述",
    "英文",
    "一步步",
    "先给方案",
    "不要太详细",
    "避免暴露",
    "保密",
    "说明",
    "推荐",
    "建议",
    "适合",
    "优先",
    "最好",
    "详细",
    "概括",
    "真实",
    "稳定"
];
export const zhAcceptanceHints = [
    "验收",
    "验证",
    "校验",
    "检查",
    "审查",
    "执行后",
    "diff",
    "测试",
    "回归测试",
    "运行",
    "通过",
    "完成后",
    "最后",
    "输出",
    "告诉我",
    "逐项打勾",
    "结论",
    "结果",
    "编译",
    "构建",
    "跑通",
    "确认",
    "列出",
    "总结",
    "报告",
    "对照",
    "验收成果",
    "通过率"
];
const zhPlanOnlyHints = [
    "先给方案",
    "只给方案",
    "先不用改",
    "先不要改",
    "不用改代码",
    "不要改代码",
    "不要改功能代码",
    "不改代码",
    "先不用提交",
    "只分析",
    "只排查",
    "只做诊断",
    "先排查",
    "先检查",
    "先看原因",
    "先定位原因",
    "先不用再改"
];
const zhReviewOnlyHints = [
    "最终检查",
    "最终验收",
    "交付检查",
    "审查结果",
    "检查是否",
    "检查隐私数据",
    "风险结论",
    "给风险结论",
    "不要继续新增",
    "不要大改",
    "只做验收",
    "只做最终检查",
    "验收阶段"
];
const zhImplementationHints = [
    "开始优化",
    "开始开发",
    "直接实现",
    "帮我修复",
    "修复",
    "生成代码",
    "写完整代码",
    "提交并推送",
    "上传到 GitHub",
    "开始改",
    "修改",
    "只改",
    "构建",
    "打包",
    "运行 npm run build",
    "bump"
];
const zhPrivacyHints = [
    "不要公开",
    "不要暴露",
    "避免别人抄袭",
    "避免抄袭",
    "保密",
    "不要泄露",
    "不要把能力具体说出去",
    "不要把所有内部能力",
    "内部能力具体说出去",
    "不要说出去",
    "照着抄",
    "do not disclose",
    "do not reveal",
    "internal capability",
    "internal workflow",
    "internal workflows",
    "implementation details",
    "proprietary"
];
const zhPhasedHints = ["先", "再", "然后", "最后", "等我说继续", "等待我说继续", "下一批", "第一批", "第二批", "分批"];
const zhCorrectionHints = ["不是", "而是", "是", "不要", "改成", "换成", "停止当前方向"];
export function hasCjk(value) {
    return /[\u4e00-\u9fff]/u.test(value);
}
export function classifyClause(clause) {
    const labels = new Set();
    const matchedRules = [];
    addIf(labels, matchedRules, "constraint", "zh_constraint", containsAny(clause, zhConstraintHints));
    addIf(labels, matchedRules, "feature", "zh_feature", containsAny(clause, zhFeatureHints));
    addIf(labels, matchedRules, "preference", "zh_preference", containsAny(clause, zhPreferenceHints));
    addIf(labels, matchedRules, "acceptance", "zh_acceptance", containsAny(clause, zhAcceptanceHints) || /npm\s+(test|run|run\s+build)|pnpm|yarn/iu.test(clause));
    addIf(labels, matchedRules, "privacy", "zh_privacy", containsAny(clause, zhPrivacyHints));
    addIf(labels, matchedRules, "phased", "zh_phased", isPhasedInstruction(clause));
    addIf(labels, matchedRules, "correction", "zh_correction", extractCorrections(clause).length > 0 || containsAny(clause, ["停止当前方向", "改成", "换成"]));
    if (labels.has("privacy")) {
        labels.add("constraint");
    }
    if (labels.has("phased") && /等我说|等待我说|继续|下一批/u.test(clause)) {
        labels.add("constraint");
    }
    if (labels.has("correction")) {
        labels.add("constraint");
        labels.add("feature");
    }
    if (/只给方案|先给方案|不用改代码|不要改代码|不改代码/u.test(clause)) {
        labels.add("constraint");
        labels.add("preference");
    }
    const confidence = Math.min(0.98, 0.45 + labels.size * 0.12 + matchedRules.length * 0.05);
    return {
        text: clause,
        labels: [...labels],
        confidence,
        matched_rules: matchedRules
    };
}
export function detectTaskMode(request) {
    if (containsAny(request, zhPlanOnlyHints) ||
        /(?:只报告|只输出|只给)\s*(?:risks?|风险|结论)/iu.test(request) ||
        /不要改\s*(?:files?|文件|代码)/iu.test(request) ||
        /\b(plan only|proposal only|do not edit|do not change code|do not change files|no code changes|diagnose|diagnosis|do not change business logic)\b/iu.test(request)) {
        return "plan-only";
    }
    if (containsAny(request, zhReviewOnlyHints) ||
        isValidationOnlyRequest(request) ||
        isInspectionOnlyRequest(request) ||
        /\b(review only|diff only|final check|delivery check|do not add new features|do not continue development)\b/iu.test(request) ||
        /\breview\b.{0,40}\bonly\b/iu.test(request)) {
        return "review-only";
    }
    if (containsAny(request, zhImplementationHints) || /\b(implement|fix|build|create|add|commit|push)\b/iu.test(request)) {
        return "implementation";
    }
    return "implementation";
}
function isValidationOnlyRequest(request) {
    const isEnglishValidation = /\b(run|rerun|check|validate)\b/iu.test(request) &&
        /\b(report|summarize|tell|show|list)\b.{0,50}\b(result|results|status|statuses|log|logs)\b/iu.test(request) &&
        !/\b(fix|implement|change|modify|create|update|commit|push|edit|write)\b/iu.test(request);
    if (isEnglishValidation) {
        return true;
    }
    return (/(重新运行|再次运行|重跑|跑一遍|跑一次)/u.test(request) &&
        /(告诉我|给我|输出|汇总|总结).{0,12}(结果|结论|日志|通过情况)/u.test(request) &&
        !/(修复|修改|实现|生成|提交|推送|改代码|写入|更新)/u.test(request));
}
function isInspectionOnlyRequest(request) {
    const isEnglishInspection = ((/\b(check|inspect|audit|review)\b.{0,60}\b(privacy|secret|token|api\s*key|risk|memory)\b/iu.test(request) &&
        /\b(report|summarize|tell|show|list)\b.{0,60}\b(risk|conclusion|result|results|finding|findings)\b/iu.test(request)) ||
        (/\b(check|confirm|inspect|validate)\b.{0,80}\b(mcp|plugin|config|format|json)\b/iu.test(request) &&
            /\b(tell|report|confirm|show)\b.{0,80}\b(if|whether|required|needed|manual)\b/iu.test(request))) &&
        !/\b(fix|implement|change|modify|create|update|commit|push|edit|write)\b/iu.test(request);
    if (isEnglishInspection) {
        return true;
    }
    return (/(重点检查|检查|确认|核对)/u.test(request) &&
        /(告诉我|给我|输出|汇总|总结|是否需要|是否)/u.test(request) &&
        !/(修复|修改|实现|生成|提交|推送|改代码|写入|更新|创建|新增)/u.test(request));
}
export function extractCorrections(text) {
    const corrections = [];
    const patterns = [
        /不是\s*([^，。；,.]+?)\s*[，,]?\s*(?:而是|是)\s*([^，。；,.]+)/gu,
        /不要\s*([^，。；,.]+?)\s*[，,]?\s*(?:要|改成|换成)\s*([^，。；,.]+)/gu,
        /停止当前方向\s*[，,]?\s*(?:改成|换成|要做)\s*([^，。；,.]+)/gu,
        /(?:this\s+is\s+)?not\s+(?:a|an|the)?\s*([^.;,]+?)\s*(?:;|,|\s+but\s+)\s*(?:make\s+it\s+|it\s+is\s+|it's\s+|use\s+|build\s+)(?:a|an|the)?\s*([^.;,]+)/giu,
        /not\s+(?:a|an|the)?\s*([^.;,]+?)\s+but\s+(?:a|an|the)?\s*([^.;,]+)/giu
    ];
    for (const pattern of patterns) {
        for (const match of text.matchAll(pattern)) {
            if (match.length === 2) {
                corrections.push({
                    rejected_direction: "current direction",
                    required_direction: cleanDirective(match[1])
                });
            }
            else if (match.length >= 3) {
                corrections.push({
                    rejected_direction: cleanDirective(match[1]),
                    required_direction: cleanDirective(match[2])
                });
            }
        }
    }
    return corrections.filter((item) => item.required_direction.length > 0);
}
export function isPhasedInstruction(text) {
    return (/先.+?(再|然后|最后)/u.test(text) ||
        /(等我说|等待我说).{0,12}(继续|下一步|下一批)/u.test(text) ||
        /(第一批|第二批|下一批|分批)/u.test(text) ||
        /\b(first|phase one|stage one|batch one).{0,80}\b(then|wait|continue|second|next)\b/iu.test(text) ||
        /\bwait until I say continue\b/iu.test(text));
}
export function isPrivacyInstruction(text) {
    return containsAny(text, zhPrivacyHints);
}
export function taskModeNote(mode) {
    if (mode === "plan-only") {
        return "Task mode: plan-only; produce analysis or a proposal before any code edit.";
    }
    if (mode === "review-only") {
        return "Task mode: review-only; inspect, validate, and summarize without broad implementation.";
    }
    return "Task mode: implementation; prepare scoped changes and verification.";
}
function addIf(labels, rules, label, rule, condition) {
    if (condition) {
        labels.add(label);
        rules.push(rule);
    }
}
function cleanDirective(value) {
    return value.trim().replace(/^继续|^再|^要/u, "").trim();
}
