/**
 * 轻量 i18n：静态节点用 data-i18n-key，弹窗轮播文案在 xmrSlides。
 * 切换语言：setLocale('en'|'zh') 或 localStorage.setItem('eutron-locale', 'en')
 */

const STORAGE_KEY = 'eutron-locale';

/** @type {'zh'|'en'} */
export function getLocale() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'zh') return stored;
  const lang = (document.documentElement.getAttribute('lang') || 'zh').toLowerCase();
  if (lang.startsWith('en')) return 'en';
  return 'zh';
}

/** @param {'zh'|'en'} locale */
export function setLocale(locale) {
  if (locale !== 'en' && locale !== 'zh') return;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.setAttribute('lang', locale === 'en' ? 'en' : 'zh');
  window.dispatchEvent(new CustomEvent('eutron:locale', { detail: { locale } }));
}

function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

/** 取当前语言文案（供 nav 等非 DOM 场景使用） */
export function t(path) {
  const v = getByPath(messages[getLocale()], path);
  return typeof v === 'string' ? v : '';
}

/**
 * data-i18n-key：纯文本 textContent
 * data-i18n-html：innerHTML（仅信任字典内字符串）
 * data-i18n-aria-label：aria-label
 */
export function applyDataI18n(root = document) {
  const locale = getLocale();
  const dict = messages[locale];
  if (!dict) return;
  root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (!key) return;
    const val = getByPath(dict, key);
    if (typeof val === 'string') el.setAttribute('aria-label', val);
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (!key) return;
    const val = getByPath(dict, key);
    if (typeof val === 'string') {
      el.innerHTML = val;
    }
  });
  root.querySelectorAll('[data-i18n-key]').forEach((el) => {
    const key = el.getAttribute('data-i18n-key');
    if (!key) return;
    const val = getByPath(dict, key);
    if (typeof val === 'string') {
      el.textContent = val;
    }
  });
}

export const messages = {
  zh: {
    nav: {
      menu: '菜单',
      home: '首 页',
      products: '产品参数',
      careers: '招聘信息',
      news: '新闻资讯',
      contact: '联系我们',
      menuOpen: '打开主菜单',
      menuClose: '关闭主菜单',
      logoAria: '返回首页',
      switchToEn: '切换为英文',
      switchToZh: '切换为中文',
    },
    home: {
      heroTitleHtml:
        '专业提供xMR薄膜晶圆材料<br>xMR传感核心晶圆材料<br><span class="hero-title__rule" aria-hidden="true"></span>以及相关的定制化服务<br>和咨询服务',
      paramLeftHtml:
        'xMR薄膜晶圆<br><span style="line-height: 24px;">8 吋、12 吋</span>',
      paramRightHtml: 'xMR传感核心晶圆<br><span>8 吋、12 吋</span>',
      stage3TitleX: 'xMR',
      stage3TitleSub: '传感核心晶圆',
      callout8Html: '8吋<br><span>AMR GMR TMR</span>',
      callout12Html: '12吋<br><span>AMR GMR TMR</span>',
      stage4TitleX: 'xMR',
      stage4TitleSub: '薄膜晶圆',
      calloutS48Html: '8吋<br><span>AMR GMR TMR</span>',
      calloutS412Html: '12吋<br><span>AMR GMR TMR</span>',
    },
    products: {
      backBtn: '返回选型',
      cursorHint: '点击晶圆探索',
      introStorageTitle: 'xMR薄膜晶圆',
      introStorageDescHtml: '8 吋、12 吋',
      introSensorTitleHtml: 'MEMS传感核心晶圆',
      introSensorDesc: 'xMR桥路结构',
      stage2SubtitleSensor: '传感核心晶圆',
      stage2SubtitleStorage: '薄膜晶圆',
      ariaSensorCard: 'TMR 传感核心测试性能摘要',
      ariaStorageCard: 'TMR 薄膜晶圆主要磁性性能摘要',
      labelMrTyp: '[    MR (TYP)    ]',
      labelHcTyp: '[    HC (TYP)    ]',
      labelHeTyp: '[    HE (TYP)    ]',
      labelProdSpec: '[    生产规格    ]',
      labelMrTypStorage: '[    MR (TYP)    ]',
      noteTunable: '性能可调',
      labelRaStore: '[   RA (存储类) (TYP)   ]',
      labelRaSense: '[   RA (传感类) (TYP)   ]',
      labelHc: '[   Hc   ]',
      labelHe: '[   He   ]',
      labelHex: '[   Hex   ]',
      labelUniformity: '[   Uniformity   ]',
      labelTempCoeff: '[   温度系数   ]',
      labelProdSpecShort: '[   生产规格   ]',
      valWaferSize: '8吋、12吋',
      heroTunnel: '隧道磁电阻',
      heroDescHtml:
        '湖北元臻微电的TMR产品矩阵包含各种参数组合<br />从大动态、高线性度、高灵敏度、高精度等特性<br />MR在136%–241%，均匀性≤1.5%<br />同时可根据客户需求进行TMR薄膜、TMR传感核心的定制化服务',
      gridStorageTitle1: 'TMR晶圆',
      gridStorageTitle2: '主要磁性性能',
      gridSensorTitle1: 'TMR传感核心',
      gridSensorTitle2: '测试性能',
      specsFooter: '性能可调',
      specProdHeader: '[ 生产规格 ]',
      specProdDataHtml: '8<span class="specs__unit">吋、</span> 12<span class="specs__unit">吋</span>',
      specProdDataSensorHtml:
        '8<span class="specs__unit">吋</span> 12<span class="specs__unit">吋</span>',
      featureDesc1: '元臻微电独有的TMR技术',
      featureDesc2: '拥有大动态高线性度',
      featureDesc3: '高灵敏度',
      featureDesc4: '高精度',
    },
    contact: {
      introH1:
        '专业提供 xMR薄膜晶圆<br />xMR 传感核心晶圆材料<br /><span class="contact-intro__rule" aria-hidden="true"></span>以及相关定制化服务的高科技企业',
      introPHtml:
        '我们的产品已经得到电网行业企业、国内龙头消费电子行业企业的认可和应用',
      visionLabel: '未来愿景',
      visionP: '元臻微电将成为国内一家面向未来，专业提供多传感器融合和异构的底层技术的高科技企业。',
      contactLabel: '联系我们',
      locSh1: '上海市，青浦区',
      locSh2: '徐泾镇汇龙路88号8楼',
      locHb1: '湖北省，孝感市',
      locHb2: '孝汉大道29号高创智造产业园西4厂房',
      contactLiu: '联系人：刘女士',
      phoneLiu: '电话：182 8035 1027',
      contactHan: '联系人：韩先生',
      phoneHan: '电话：136 0938 2791',
    },
    careers: {
      heroTitle: '加入我们',
      heroP1: '在这里，我们不以出身、学历或过往光环作为唯一的评判标准。',
      heroP2: '我们相信，真正决定一个人价值的，是他面对问题时的态度，以及对结果的责任感。',
      valuesLead: '我们更愿意和这样的人一起工作',
      valueTag1: '愿意为结果负责，而不是过程漂亮',
      valueTag2: '能持续学习，而不是依赖过去的经验',
      valueTag3: '在压力中依然选择把事情做好',
      valuesFooter: '如果你认同这些，我们会非常欢迎你',
      jobCity: '工作城市：孝感-孝南区',
      jobLocationDefault: '湖北 - 孝感 - 孝南区',
      job2City: '工作城市：上海-青浦区',
      job2Location: '上海 - 青浦 - 徐泾镇',
      job4City: '工作城市：苏州-工业园区',
      job4Location: '江苏 - 苏州 - 工业园区',
      headingDuty: '[ 岗位职责 ]',
      headingWork: '[ 工作内容 ]',
      headingReq: '[ 职位要求 ]',
      headingSalary: '[ 薪资福利 ]',
      headingCity: '[ 工作城市 ]',
      headingFuture: '[ 未来发展方向 ]',
      sendResume: '简历请发送至邮箱：info@eutronsense.com',
      job1Title: '动力设备工程师',
      job2Title: '项目助理',
      job3Title: '会计专员',
      job4Title: 'MEMS工艺工程师',
      job5Title: '行政专员/助理',
      benefitsRowHtml:
        '<span class="inline-block w-20 text-gray-400">福　　利：</span>每年体检、生日关怀、不定期团建娱乐等',
      job1DutyP: '动力设备日常维护',
      job1Work1: '1. 动力设备的日常巡检及保养；',
      job1Work2: '2. 动力设备故障诊断与维修；',
      job1Work3: '3. 领导安排的其它工作。',
      job1Req1Html:
        '<span class="inline-block w-20 text-gray-400">学　　历：</span>专科',
      job1Req2Html:
        '<span class="inline-block w-20 text-gray-400">专　　业：</span>机电一体化、电气工程及其自动化、机械制造与自动化等；',
      job1Req3Html:
        '<span class="inline-block w-20 text-gray-400">工作经验：</span>要求具有机电设备维护经验1-3年以上，有半导体行业从业经历者优先；',
      job1Sal1Html: '<span class="inline-block w-20 text-gray-400">薪　　资：</span>5-8K',
      job2Duty1: '1. 公司项目（研发、生产、合作等）的跟踪和调研；',
      job2Duty2: '2. 专利申请的跟踪和调研；',
      job2Duty3: '3. 基金项目申请、以及高校横向联合；',
      job2Duty4: '4. 负责董事长技术相关的其它任务。',
      job2FutureP: '研发部助理/经理、研发部副总经理、公司副总经理<br>（沿技术管理线）',
      job2Req1: '1. 三观正、具有极强的自理能力、上进心； 同时具备一定的管理、协调能力；',
      job2Req2: '2. 物理学本科，或者硕士；',
      job2Req3: '3. 申请过国自然项目，清楚国家项目申请的流程；',
      job2Req4: '4. 踏实、老实、肯钻研；',
      job2Req5: '5. 眼勤、手勤、脚勤、眼中有活；',
      job2Req6: '6. 长相朴实、耐看，个人卫生概念强，能一定量饮酒，不矫情！最好会开车；',
      job2ReqNote: '要求面试人提供至少三个 Reference，三个 Reference 都必须和工作相关。',
      job2Sal1Html: '<span class="inline-block w-20 text-gray-400">薪　　资：</span>15-30K',
      job3DutyP: '负责生产成本、研发支出核算管理',
      job3Work1: '1. 负责生产成本核算，准确归集与分配生产成本；',
      job3Work2: '2. 负责出具成本分析，提出优化建议；',
      job3Work3: '3. 负责进行研发支出的界定与核算，研发相关资料的收集、归档；',
      job3Work4: '4. 负责生产成本、研发支出预算的执行管理；',
      job3Work5: '5. 负责对各项优惠政策的收集整理及落地执行；',
      job3Work6: '6. 负责配合进行ERP系统基础数据的设置与维护；',
      job3Work7: '7. 完成上级安排的其他工作。',
      job3ReqP: '财务相关专业',
      job3Sal1Html: '<span class="inline-block w-20 text-gray-400">薪　　资：</span>7-10K',
      job4DutyP: '主要负责MEMS器件的制备',
      job4Work1:
        '1. 包括但不限于协助技术部进行器件设计、工艺制备、测试工作，数据分析（逻辑思维严密，数理基础扎实）等环节开展工作。',
      job4Work2:
        '2. 参与新产品导入的工艺验证及改进工作（学习和理解能力强，能够快速理解新知识和技术），对工艺中出现的问题能够进行分析并提出解决方案。',
      job4Req1: '1. 忠诚、细心、耐心、责任心，对芯片制备工艺和技术有浓厚兴趣，愿意在芯片领域长期发展；',
      job4Req2: '2. 年龄35周岁以下，样貌及精神面貌良好，具备一定创业精神；',
      job4Req3: '3. 执行力强，按照领导布置的任务，在规定时间内完成领导安排的各项合理任务；',
      job4Req4:
        '4. 本科或研究生学历，有MEMS芯片制备经验者优先（包括但不限于会使用CAD、Layout editor画图软件，熟悉超净间的刻蚀规程和工作流程）；',
      job4Req5: '5. 常驻苏州，能接受出差，每次预计出差时长3天-14天。',
      job4Sal1Html: '<span class="inline-block w-20 text-gray-400">薪　　资：</span>8-15K',
      job5DutyP: '负责公司的行政事务',
      job5Work1: '1. 接待访客、安排会议、处理文件复印、办公设备维护等；',
      job5Work2: '2. 负责公司的人员招聘勤记录等人事管理事务；',
      job5Work3: '3. 负责公司仓库管理，确保公司物品采购、出库、补货等工作规范有序；',
      job5Work4: '4. 负责公司日常开支报销，包括差旅费、办公用品等；',
      job5Work5: '5. 协助公司领导完成各种行政后勤工作任务。',
      job5ReqP: '样貌及精神面貌良好，不怯场',
      job5Sal1Html: '<span class="inline-block w-20 text-gray-400">薪　　资：</span>4-5K',
    },
    news: {
      pageTitle: '新闻资讯',
      readMore: '查看详情',
    },
    xmr: {
      exploreBtn: '探索 xMR',
      closeLabel: '关闭',
    },
    xmrSlides: [
      {
        title: 'AMR',
        subtitle: '各向异性磁电阻',
        description:
          '湖北元臻微电独有的AMR技术从基础的的材料上解决了2次方、4次方、8次方谐振波的噪声问题，且依然具有良好的本征特性。',
        line: '2次方、4次方、8次方谐振波的噪声问题',
        image: '/amr.png',
      },
      {
        title: 'GMR',
        subtitle: '巨磁电阻',
        description:
          '湖北元臻微电独有的GMR技术已建立完整体系，MR达到12%-15%，均匀性≤1.0%，可根据客户需求进行定制化制备。',
        line: 'MR达到12%-15%，均匀性≤1.0%',
        image: '/gmr.png',
      },
      {
        title: 'TMR',
        subtitle: '隧道磁电阻',
        description:
          '湖北元臻微电独有的TMR技术已建立完整体系，拥有大动态高线性度、高灵敏度高精度特性。MR达到136%-241%，均匀性≤1.5%，可根据客户需求进行定制化制备。',
        line: 'MR达到136%-241%，均匀性≤1.5%',
        image: '/tmr.png',
      },
    ],
  },
  en: {
    nav: {
      menu: 'Menu',
      home: 'Home',
      products: 'Tech Specs',
      careers: 'Careers',
      news: 'News',
      contact: 'Contact Us',
      menuOpen: 'Open main menu',
      menuClose: 'Close main menu',
      logoAria: 'Back to home',
      switchToEn: 'Switch to English',
      switchToZh: 'Switch to Chinese',
    },
    home: {
      heroTitleHtml:
        'Specialized in xMR film Wafers<br>xMR Sensor Wafers<br><span class="hero-title__rule" aria-hidden="true"></span>and customized services',
      paramLeftHtml:
        'xMR film wafers<br><span style="line-height: 24px;">8-inch &amp; 12-inch</span>',
      paramRightHtml:
        'xMR Sensor <br>wafers<br><span style="line-height: 24px;">8-inch &amp; 12-inch</span>',
      stage3TitleX: 'xMR',
      stage3TitleSub: 'Sensor wafers',
      callout8Html: '8-inch<br><span>AMR GMR TMR</span>',
      callout12Html: '12-inch<br><span>AMR GMR TMR</span>',
      stage4TitleX: 'xMR',
      stage4TitleSub: 'Thin-Film Wafers',
      calloutS48Html: '8-inch<br><span>AMR GMR TMR</span>',
      calloutS412Html: '12-inch<br><span>AMR GMR TMR</span>',
    },
    products: {
      backBtn: 'Back to selection',
      cursorHint: 'Click wafer to explore',
      introStorageTitle: 'xMR film Wafers',
      introStorageDescHtml: '8-inch,12-inch',
      introSensorTitleHtml: 'MEMS Sensor<br />  wafers',
      introSensorDesc: 'xMR bridge structure',
      stage2SubtitleSensor: 'Sensor Wafers',
      stage2SubtitleStorage: 'film wafers',
      ariaSensorCard: 'TMR sensing core performance summary',
      ariaStorageCard: 'TMR thin-film wafer magnetic performance summary',
      labelMrTyp: '[    MR (TYP)    ]',
      labelHcTyp: '[    HC (TYP)    ]',
      labelHeTyp: '[    HE (TYP)    ]',
      labelProdSpec: '[    Production    ]',
      labelMrTypStorage: '[    MR (TYP)    ]',
      noteTunable: 'Tunable performance',
      labelRaStore: '[   RA (storage) (TYP)   ]',
      labelRaSense: '[   RA (sensor) (TYP)   ]',
      labelHc: '[   Hc   ]',
      labelHe: '[   He   ]',
      labelHex: '[   Hex   ]',
      labelUniformity: '[   Uniformity   ]',
      labelTempCoeff: '[   Temp. coefficient   ]',
      labelProdSpecShort: '[   Production   ]',
      valWaferSize: '8-inch、12-inch',
      heroTunnel: 'Tunnel Magnetoresistance',
      heroDescHtml:
        'The TMR product matrix includes varieties of combinations of TMR parameters,<br />such as high dynamic range, high linearity, sensitivity, precision, and temperature drift.<br />The MR is typically 136%–241%, with uniformity ≤1.5%.<br />We also offer customized TMR films and TMR sensing cores on request.',
      gridStorageTitle1: 'TMR Wafer',
      gridStorageTitle2: 'Key Magnetic Specs',
      gridSensorTitle1: 'TMR Sensing Core',
      gridSensorTitle2: 'Test Performance',
      specsFooter: 'Tunable performance',
      specProdHeader: '[ Production ]',
      specProdDataHtml:
        '8<span class="specs__unit"> in, </span> 12<span class="specs__unit"> in</span>',
      specProdDataSensorHtml:
        '8<span class="specs__unit"> in</span> 12<span class="specs__unit"> in</span>',
      featureDesc1: "Eutronsense's TMR technology",
      featureDesc2: 'Wide dynamic range linearity',
      featureDesc3: 'High sensitivity',
      featureDesc4: 'High precision',
    },
    contact: {
      introH1:
        'Specialized in xMR film Wafers<br />xMR Sensor wafers<br /><span class="contact-intro__rule" aria-hidden="true"></span>and customized services.',
      introPHtml:
        'Our products have been validated by leading companies in State Power Grid and the Chinese consumer electronics market.',
      visionLabel: 'Future Vision',
      visionP:
        'In just 19 months, our products have been validated by leading organizations, including State Grid, top-tier Chinese consumer electronics OEMs, and globally recognized consumer electronics brands.',
      contactLabel: 'Contact',
      locSh1: 'Qingpu District, Shanghai',
      locSh2: '8F, No.88 Huilong Rd, Xujing Town',
      locHb1: 'Xiaogan City, Hubei',
      locHb2: 'West Plant 4, Gaochuang Industrial Park, No.29 Xiaohan Ave',
      contactLiu: 'Contact: Ms. Liu',
      phoneLiu: 'Tel: 182 8035 1027',
      contactHan: 'Contact: Mr. Han',
      phoneHan: 'Tel: 136 0938 2791',
    },
    careers: {
      heroTitle: 'Join Us',
      heroP1: 'We do not judge solely by background, degree, or past titles.',
      heroP2: 'We value attitude toward problems and ownership of outcomes.',
      valuesLead: 'We prefer to work with people who',
      valueTag1: 'Own outcomes, not just polished process',
      valueTag2: 'Keep learning instead of relying on past experience',
      valueTag3: 'Still deliver under pressure',
      valuesFooter: 'If this resonates, we would love to meet you.',
      jobCity: 'Location: Xiaonan District, Xiaogan',
      jobLocationDefault: 'Hubei - Xiaogan - Xiaonan District',
      job2City: 'Location: Shanghai - Qingpu District',
      job2Location: 'Shanghai - Qingpu - Xujing Town',
      job4City: 'Location: Suzhou - Industrial Park',
      job4Location: 'Jiangsu - Suzhou - Industrial Park',
      headingDuty: '[ Responsibilities ]',
      headingWork: '[ Work content ]',
      headingReq: '[ Requirements ]',
      headingSalary: '[ Compensation ]',
      headingCity: '[ Location ]',
      headingFuture: '[ Career path ]',
      sendResume: 'Send resume to: info@eutronsense.com',
      job1Title: 'Power Equipment Engineer',
      job2Title: 'Project Assistant',
      job3Title: 'Accounting Specialist',
      job4Title: 'MEMS Process Engineer',
      job5Title: 'Admin Specialist / Assistant',
      benefitsRowHtml:
        '<span class="inline-block w-24 md:w-20 text-gray-400">Benefits:</span>Annual health check-ups, birthday care, team building and social events, etc.',
      job1DutyP: 'Routine maintenance of power equipment.',
      job1Work1: '1. Daily inspection and preventive maintenance of power equipment;',
      job1Work2: '2. Fault diagnosis and repair of power equipment;',
      job1Work3: '3. Other tasks assigned by management.',
      job1Req1Html:
        '<span class="inline-block w-24 md:w-24 text-gray-400">Education:&nbsp;</span>Associate degree or equivalent',
      job1Req2Html:
        '<span class="inline-block w-24 md:w-24 text-gray-400">Major:&nbsp;</span>Mechatronics, electrical engineering &amp; automation, mechanical manufacturing &amp; automation, etc.',
      job1Req3Html:
        '<span class="inline-block w-24 md:w-24 text-gray-400">Experience:&nbsp;</span>1–3+ years of electromechanical equipment maintenance; semiconductor industry experience preferred.',
      job1Sal1Html: '<span class="inline-block w-24 md:w-20 text-gray-400">Salary:</span>5–8K (CNY)',
      job2Duty1: '1. Track and research company projects (R&amp;D, production, partnerships, etc.);',
      job2Duty2: '2. Track and research patent filings;',
      job2Duty3: '3. Grant applications and university–industry collaboration;',
      job2Duty4: '4. Other technical tasks for the Chairman as assigned.',
      job2FutureP:
        'R&amp;D assistant/manager, VP of R&amp;D, VP of the company<br>(technical management track)',
      job2Req1:
        '1. Strong values, highly self-motivated and self-disciplined, with coordination and basic management skills;',
      job2Req2: '2. Bachelor’s or Master’s degree in physics;',
      job2Req3: '3. Experience applying for NSFC-type grants and familiarity with national funding procedures;',
      job2Req4: '4. Down-to-earth, honest, and willing to dig deep;',
      job2Req5: '5. Proactive—hands, feet, and eyes always engaged;',
      job2Req6:
        '6. Plain, approachable appearance; strong personal hygiene; able to drink socially when appropriate, not overly delicate; driver’s license preferred;',
      job2ReqNote:
        'Candidates must provide at least three work-related professional references.',
      job2Sal1Html: '<span class="inline-block w-24 md:w-20 text-gray-400">Salary:</span>15–30K (CNY)',
      job3DutyP: 'Responsible for production cost accounting and R&amp;D expense management.',
      job3Work1: '1. Accurately accumulate and allocate production costs;',
      job3Work2: '2. Produce cost analyses and optimization recommendations;',
      job3Work3: '3. Define and account for R&amp;D expenses; collect and archive related documentation;',
      job3Work4: '4. Manage execution of production cost and R&amp;D expense budgets;',
      job3Work5: '5. Collect, organize, and implement applicable incentive and subsidy policies;',
      job3Work6: '6. Support setup and maintenance of ERP master data;',
      job3Work7: '7. Other tasks assigned by leadership.',
      job3ReqP: 'Finance or accounting-related major.',
      job3Sal1Html: '<span class="inline-block w-24 md:w-20 text-gray-400">Salary:</span>7–10K (CNY)',
      job4DutyP: 'Primarily responsible for fabrication of MEMS devices.',
      job4Work1:
        '1. Assist engineering with device design, process fabrication, testing, and data analysis (rigorous logic and solid math/physics fundamentals), among other tasks;',
      job4Work2:
        '2. Participate in process validation and improvement for new product introduction (quick learner); analyze process issues and propose solutions;',
      job4Req1:
        '1. Loyal, meticulous, patient, and accountable; strong interest in chip process technology and long-term commitment to the field;',
      job4Req2: '2. Under 35 years old; professional appearance and demeanor; entrepreneurial mindset;',
      job4Req3:
        '3. Strong execution—complete assigned tasks within deadlines;',
      job4Req4:
        '4. Bachelor’s or Master’s degree; MEMS fabrication experience preferred (including CAD/layout editors, familiarity with cleanroom etch procedures);',
      job4Req5: '5. Based in Suzhou; willing to travel (typical trips 3–14 days).',
      job4Sal1Html: '<span class="inline-block w-24 md:w-20 text-gray-400">Salary:</span>8–15K (CNY)',
      job5DutyP: 'Handle company administrative affairs.',
      job5Work1: '1. Visitor reception, meeting scheduling, copying, and office equipment upkeep;',
      job5Work2: '2. HR-related tasks including recruitment and attendance records;',
      job5Work3: '3. Warehouse management—orderly purchasing, outbound logistics, and replenishment;',
      job5Work4: '4. Routine expense reimbursement (travel, office supplies, etc.);',
      job5Work5: '5. Support executives with administrative and logistics tasks.',
      job5ReqP: 'Professional appearance and demeanor; confident in front of others.',
      job5Sal1Html: '<span class="inline-block w-24 md:w-20 text-gray-400">Salary:</span>4–5K (CNY)',
    },
    news: {
      pageTitle: 'News',
      readMore: 'Read more',
    },
    xmr: {
      exploreBtn: 'Explore xMR',
      closeLabel: 'Close',
    },
    xmrSlides: [
      {
        title: 'AMR',
        subtitle: 'Anisotropic Magnetoresistance',
        description:
          "Eutronsense's unique AMR technology leverages a proprietary material solution that fundamentally eliminates noise at the 2nd, 4th, and 8th harmonics, while maintaining superior intrinsic characteristics.",
        line: 'eliminates noise at the 2nd, 4th, and 8th harmonics',
        image: '/amr_en.png',
      },
      {
        title: 'GMR',
        subtitle: 'Giant Magnetoresistance',
        description:
          "Eutronsense's unique GMR technology boasts world-class performance, with a magnetoresistance (MR) ratio of 12%-15% and uniformity ≤1.0%. This mature platform enables us to custom-fabricate devices tailored to precise customer specifications.",
        line: 'with a magnetoresistance (MR) ratio of 12%-15% and uniformity ≤1.0%',
        image: '/gmr.png',
      },
      {
        title: 'TMR',
        subtitle: 'Tunneling Magnetoresistance',
        description:
          "Eutronsense's unique TMR technology boasts world-class performance,featuring a wide dynamic range, high linearity, sensitivity, and precision, with a magnetoresistance (MR) ratio of 136%-241% and uniformity ≤1.5%. This mature platform enables us to custom-fabricate devices tailored to precise customer specifications.",
        line: 'with a magnetoresistance (MR) ratio of 136%-241% and uniformity ≤1.5%',
        image: '/tmr.png',
      },
    ],
  },
};
