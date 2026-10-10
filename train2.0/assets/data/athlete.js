// 只读镜像：athlete-profile.md + body-metrics.md。由 update-athlete-profile 同步维护。
// 未记录的标量用 null，未记录的列表用 []；不要把示例或猜测写成个人事实。
const ATHLETE_DATA = {
  profile: {
    updatedAt: "2026-10-10",
    basic: {
      birthDate: "1995-11-30",
      ageYears: null,
      ageAsOf: null,
      sex: "男",
      strengthExperience: "自大学时期开始健身房训练，既往以三分化、四分化等传统分部位训练为主，孤立动作训练较多（截至 2026-10-10 用户自述）",
      basketballExperience: "学生时期曾在院队打球，尚未接受系统的篮球专项训练（截至 2026-10-10 用户自述）",
      dominantHand: "右手",
      basketballPosition: "有小前锋、得分后卫和控球后卫位置的实战经历"
    },
    goals: [{
      priority: 1,
      title: "增强下肢力量，并以缓解膝痛为目标",
      target: null,
      targetDate: null,
      updatedAt: "2026-10-10"
    }, {
      priority: 2,
      title: "提升篮球终结的稳定性",
      target: null,
      targetDate: null,
      updatedAt: "2026-10-10"
    }, {
      priority: 3,
      title: "提升篮球专项体能，在心肺负荷升高时仍能维持投篮命中率",
      target: null,
      targetDate: null,
      updatedAt: "2026-10-10"
    }],
    conditions: {
      weeklyDays: "3–4",
      sessionMinutes: null,
      basketballSchedule: "每周 2–3 次",
      equipment: "健身房常规器械",
      venues: "健身房、球场"
    },
    restrictions: [{
      description: "膝部情况：双膝内侧及外侧均有疼痛，其中右膝内侧疼痛最为明显。",
      source: "用户自述（2026-10-10）",
      updatedAt: "2026-10-10"
    }, {
      description: "眼部情况：双眼存在视网膜穿孔，右眼伴有视网膜浅脱。",
      source: "用户自述（2026-10-10）",
      updatedAt: "2026-10-10"
    }, {
      description: "训练限制：尽量避免极限重量，以及可能导致腹内压、眼压快速升高的训练。",
      source: "用户明确提出的训练限制（2026-10-10）",
      updatedAt: "2026-10-10"
    }],
    changes: [{
      date: "2026-10-10",
      detail: "建立个人档案：记录出生日期、力量与篮球训练经历、惯用手及打过的篮球位置。",
      source: "用户对话（2026-10-10）"
    }, {
      date: "2026-10-10",
      detail: "按用户要求润色训练经历与位置描述；按用户列出顺序补充下肢力量与缓解膝痛、终结稳定性、专项体能与高心肺负荷下命中率三项目标。",
      source: "用户对话（2026-10-10）"
    }, {
      date: "2026-10-10",
      detail: "补充性别男、每周可训练 3–4 天、篮球活动每周 2–3 次、健身房常规器械及健身房与球场条件。",
      source: "用户对话（2026-10-10）"
    }, {
      date: "2026-10-10",
      detail: "补充双膝疼痛及右膝内侧最明显的情况、双眼视网膜穿孔与右眼视网膜浅脱的自述，以及尽量避免极限重量和腹内压、眼压快速升高训练的明确限制。",
      source: "用户对话（2026-10-10）"
    }]
  },
  metricsUpdatedAt: "2026-10-10",
  measurements: [{
    id: "BM-20261010-01",
    date: "2026-10-10",
    time: "08:14",
    heightCm: null,
    weightKg: 72.35,
    bodyFatPct: 19.3,
    waistCm: 81,
    methods: {
      heightCm: null,
      weightKg: "家用体脂秤（品牌/型号未记录）",
      bodyFatPct: "家用体脂秤（品牌/型号未记录）",
      waistCm: null
    },
    note: "截图原始测量时间为 08:14:43；两张截图的重叠指标仅记录一次。应用显示：基础代谢 1557.0 kcal（偏低）、蛋白质 14.9%（偏低）、肌肉量 55.5 kg、BMI 22.5、骨量 2.9 kg、肥胖等级 22.5（正常）、皮下脂肪率 12.9%、内脏脂肪 9（未显示单位）、体水分率 55.3%、身体类型「标准型」、身体得分 93、去脂体重 58.40 kg、身体年龄 30 岁、标准体重 70.40 kg。以上为应用报告值及标注；身体年龄不作为实际年龄，标准体重不作为个人目标，未据 BMI 推算身高。用户补充确认截图由家用体脂秤测量，腰围 81 cm 与截图为同次测量；腰围工具与方法未记录。",
    source: "用户提供的两张数据分析截图及对话补充（2026-10-10）",
    updatedAt: "2026-10-10"
  }, {
    id: "BM-20261010-02",
    date: "2026-10-10",
    time: null,
    heightCm: 179,
    weightKg: null,
    bodyFatPct: null,
    waistCm: null,
    methods: {
      heightCm: "裸足（测量工具未记录）",
      weightKg: null,
      bodyFatPct: null,
      waistCm: null
    },
    note: "用户确认裸足身高于 2026-10-10 测量；具体时间未记录，与同日体脂秤测量的先后关系未确认。",
    source: "用户对话（2026-10-10）",
    updatedAt: "2026-10-10"
  }],
  corrections: []
};
