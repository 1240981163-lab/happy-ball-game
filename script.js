/**
 * 欢乐球球 - 完整游戏逻辑
 * 纯原生JS，无任何第三方依赖
 * 
 * 架构说明：
 * 1. CONFIG - 全局配置（所有可调参数集中在此）
 * 2. StorageManager - 本地存储管理
 * 3. UIManager - 弹窗/HUD/提示管理
 * 4. GameRenderer - Canvas渲染引擎
 * 5. PhysicsEngine - 物理计算
 * 6. PlatformGenerator - 平台生成器
 * 7. GameEngine - 主游戏逻辑
 * 8. InputHandler - 输入处理（触摸/鼠标）
 * 9. ShareManager - 分享功能
 * 10. App - 应用入口
 */

'use strict';

/* ==========================================
   全局配置 - 所有难度/物理/视觉参数集中管理
   修改此处即可调整游戏体验
   ========================================== */
const CONFIG = {
  // ---- 物理参数 ----
  GRAVITY: 0.45,           // 重力加速度（像素/帧²）
  BALL_RADIUS: 14,         // 小球半径（像素）
  BOUNCE_FACTOR: 0.62,     // 弹性系数（0-1，越大弹得越高）
  MAX_FALL_SPEED: 18,      // 最大下落速度
  MIN_BOUNCE_VY: -6,       // 最小有效弹起速度（防止无限微弹）
  SCROLL_SPEED_BASE: 1.8,  // 基础场景下移速度（像素/帧）
  SCROLL_SPEED_MAX: 4.0,   // 最大场景下移速度

  // ---- 场景结构 ----
  PLATFORM_COUNT: 12,      // 同屏显示的平台层数
  PLATFORM_HEIGHT: 18,     // 每层平台的厚度（像素）
  PLATFORM_LAYER_HEIGHT: 110, // 层间距（像素）
  CYLINDER_RADIUS_RATIO: 0.42, // 圆柱半径相对屏幕宽度的比例
  WALL_HEIGHT_RATIO: 0.5,  // 橙色立墙高度相对层间距的比例

  // ---- 分数系统 ----
  COMBO_SCORE_BASE: 3,     // 连击基数（3的n次方）
  COMBO_SCORE_CAP: 36,     // 单次连击得分上限
  SCORE_PER_LAYER: 1,      // 每层基础分（不连击时）

  // ---- 难度配置（简单/高玩） ----
  DIFFICULTY: {
    newbie: {
      // 初始橙色板块占比（0-1）
      initialDangerRatio: 0.02,
      // 难度递增速度（每下落N层增加一定危险度）
      difficultyIncreaseInterval: 15,
      difficultyIncreaseAmount: 0.025,
      // 最大橙色板块占比
      maxDangerRatio: 0.55,
      // 缺口数量范围 [min, max]
      gapCount: [3, 5],
      // 缺口宽度角度范围（度）
      gapAngle: [55, 80],
      // 橙色立墙出现概率（前50层）
      wallProbabilityEarly: 0.0,
      // 橙色立墙出现概率（后期）
      wallProbabilityLate: 0.15,
      // 后期立墙触发层数
      wallLateStartLayer: 50,
      // 连续对齐缺口概率
      alignedGapProbability: 0.65,
      // 连击得分倍率
      comboMultiplier: 1.0,
      // 初始层数难度偏移（0=最简单）
      startLayerOffset: 0,
      // 难度名称
      label: '萌新'
    },
    expert: {
      initialDangerRatio: 0.55,
      difficultyIncreaseInterval: 4,
      difficultyIncreaseAmount: 0.05,
      maxDangerRatio: 0.92,
      gapCount: [1, 2],
      gapAngle: [25, 40],
      wallProbabilityEarly: 0.45,
      wallProbabilityLate: 0.75,
      wallLateStartLayer: 5,
      alignedGapProbability: 0.08,
      comboMultiplier: 2.0,
      startLayerOffset: 1000,
      label: '高玩'
    }
  },

  // ---- 视觉配置 ----
  COLORS: {
    background: '#1a1a2e',
    backgroundGradientTop: '#0f0f1a',
    backgroundGradientBottom: '#1a1a2e',
    cylinder: '#16213e',
    cylinderEdge: 'rgba(255,255,255,0.08)',
    platformNormal: '#2d3748',
    platformNormalEdge: '#4a5568',
    platformNormalTop: '#3d4d5e',
    platformDanger: '#e94560',
    platformDangerEdge: '#ff6b85',
    platformDangerTop: '#ff4d6a',
    wallDanger: '#e94560',
    wallDangerEdge: '#ff6b85',
    ball: '#ffffff',
    ballShadow: 'rgba(255,255,255,0.3)',
    ballHighlight: 'rgba(255,255,255,0.8)',
    gapShadow: 'rgba(0,0,0,0.6)',
    comboText: '#f5a623',
    scoreText: '#ffffff',
    depthFog: 'rgba(26,26,46,0.3)'
  },

  // ---- 操作配置 ----
  TOUCH_SENSITIVITY: 1.2,  // 触摸灵敏度（像素对应旋转角度）
  ROTATION_FRICTION: 0.88, // 旋转惯性摩擦系数（越小越快停止）
  MAX_ROTATION_SPEED: 8,   // 最大旋转速度（度/帧）

  // ---- 文案配置 ----
  TEXT: {
    expertTopText: '你怎么才这点分啊？不行哦。',
    newbieTopText: '你很厉害哦，你怎么这么强啊！',
    surrenderSwitchMsg: '已为你切换到萌新简单模式，加油哦~',
    welcomeTitle: '你好呀。',
    welcomeQuestion: '你是否是欢乐球球的游戏高玩呢？'
  }
};

/* ==========================================
   本地存储管理器
   ========================================== */
const StorageManager = {
  KEYS: {
    USERNAME: 'jqq_username',
    DIFFICULTY: 'jqq_difficulty',
    HIGH_SCORE: 'jqq_highscore',
    RANKING: 'jqq_ranking',
    FRIEND_SCORES: 'jqq_friend_scores'
  },

  get(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage读取失败:', e);
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage写入失败:', e);
    }
  },

  getJSON(key) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      return null;
    }
  },

  setJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('localStorage写入失败:', e);
    }
  },

  hasUser() {
    return !!(this.get(this.KEYS.USERNAME) && this.get(this.KEYS.DIFFICULTY));
  },

  getUsername() { return this.get(this.KEYS.USERNAME) || ''; },
  getDifficulty() { return this.get(this.KEYS.DIFFICULTY) || 'newbie'; },
  getHighScore() { return parseInt(this.get(this.KEYS.HIGH_SCORE) || '0', 10); },

  saveHighScore(score) {
    const current = this.getHighScore();
    if (score > current) {
      this.set(this.KEYS.HIGH_SCORE, score);
      return true; // 是否创造新纪录
    }
    return false;
  },

  // 获取本地排行榜（所有历史用户）
  getRanking() {
    return this.getJSON(this.KEYS.RANKING) || [];
  },

  // 更新排行榜（按用户名合并最高分）
  updateRanking(username, score, difficulty) {
    let ranking = this.getRanking();
    const idx = ranking.findIndex(r => r.name === username);
    if (idx >= 0) {
      if (score > ranking[idx].score) {
        ranking[idx].score = score;
        ranking[idx].difficulty = difficulty;
        ranking[idx].time = Date.now();
      }
    } else {
      ranking.push({ name: username, score, difficulty, time: Date.now() });
    }
    // 按分数降序排列
    ranking.sort((a, b) => b.score - a.score);
    // 最多保留50条
    ranking = ranking.slice(0, 50);
    this.setJSON(this.KEYS.RANKING, ranking);
    return ranking;
  },

  // 获取好友成绩（从URL参数/本地缓存）
  getFriendScores() {
    return this.getJSON(this.KEYS.FRIEND_SCORES) || [];
  },

  // 保存好友成绩
  saveFriendScore(friendData) {
    let friends = this.getFriendScores();
    const idx = friends.findIndex(f => f.name === friendData.name);
    if (idx >= 0) {
      if (friendData.score > friends[idx].score) {
        friends[idx] = friendData;
      }
    } else {
      friends.push(friendData);
    }
    friends.sort((a, b) => b.score - a.score);
    friends = friends.slice(0, 20);
    this.setJSON(this.KEYS.FRIEND_SCORES, friends);
  },

  clearUser() {
    try {
      localStorage.removeItem(this.KEYS.USERNAME);
      localStorage.removeItem(this.KEYS.DIFFICULTY);
      localStorage.removeItem(this.KEYS.HIGH_SCORE);
    } catch (e) {}
  }
};

/* ==========================================
   UI管理器 - 弹窗/HUD/提示管理
   ========================================== */
const UIManager = {
  toastTimer: null,

  // 显示Toast提示
  showToast(msg, duration = 2500) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  },

  // 显示连击动画
  showComboPopup(combo, score) {
    const existing = document.querySelector('.combo-popup');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'combo-popup';
    el.textContent = combo >= 3 ? `${combo}连击! +${score}` : `+${score}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
  },

  // 死亡闪光效果
  showDeathFlash() {
    const el = document.createElement('div');
    el.className = 'death-flash';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 500);
  },

  // 弹出/隐藏弹窗
  show(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  },

  hide(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  },

  // 更新HUD分数显示
  updateHUD(score, combo, username) {
    document.getElementById('currentScore').textContent = score;
    document.getElementById('currentCombo').textContent = combo;
    if (username !== undefined) {
      document.getElementById('playerNameDisplay').textContent = username;
    }
  },

  // 渲染排行榜
  renderRanking(currentUsername) {
    const ranking = StorageManager.getRanking();
    const friendScores = StorageManager.getFriendScores();
    const list = document.getElementById('rankingList');

    if (!ranking.length) {
      list.innerHTML = '<div class="empty-ranking">还没有任何记录，快去游戏吧！</div>';
    } else {
      list.innerHTML = ranking.map((item, i) => {
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
        const isMe = item.name === currentUsername;
        const modeLabel = CONFIG.DIFFICULTY[item.difficulty]?.label || '';
        return `
          <div class="ranking-item ${isMe ? 'me' : ''}">
            <span class="rank-num ${rankClass}">${rankIcon}</span>
            <div style="flex:1;overflow:hidden">
              <div class="rank-name">${escapeHtml(item.name)}${isMe ? ' (我)' : ''}</div>
              <div class="rank-mode">${modeLabel}模式</div>
            </div>
            <span class="rank-score">${item.score}</span>
          </div>
        `;
      }).join('');
    }

    // 好友成绩
    const friendContainer = document.getElementById('friendScores');
    const friendList = document.getElementById('friendList');
    if (friendScores.length > 0) {
      friendContainer.classList.remove('hidden');
      friendList.innerHTML = friendScores.map((item, i) => `
        <div class="ranking-item">
          <span class="rank-num">${i + 1}</span>
          <div style="flex:1;overflow:hidden">
            <div class="rank-name">${escapeHtml(item.name)}</div>
            <div class="rank-mode">${item.difficulty === 'expert' ? '高玩' : '萌新'}模式</div>
          </div>
          <span class="rank-score">${item.score}</span>
        </div>
      `).join('');
    } else {
      friendContainer.classList.add('hidden');
    }
  }
};

// HTML转义，防XSS
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ==========================================
   分享管理器
   ========================================== */
const ShareManager = {
  // 生成分享链接（带个人成绩参数）
  generateShareUrl(username, score, difficulty) {
    const base = window.location.href.split('?')[0].split('#')[0];
    const params = new URLSearchParams({
      share: '1',
      n: username,
      s: score,
      d: difficulty
    });
    return `${base}?${params.toString()}`;
  },

  // 解析URL中的分享参数
  parseShareParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('share') === '1') {
      return {
        name: params.get('n') || '',
        score: parseInt(params.get('s') || '0', 10),
        difficulty: params.get('d') || 'newbie'
      };
    }
    return null;
  },

  // 执行分享
  share(username, score, difficulty) {
    const url = this.generateShareUrl(username, score, difficulty);
    const text = `我在欢乐球球获得了${score}分！快来挑战我！`;

    // 优先使用Web Share API（微信等支持）
    if (navigator.share) {
      navigator.share({
        title: '欢乐球球',
        text: text,
        url: url
      }).catch(() => this.fallbackShare(url, text));
    } else {
      this.fallbackShare(url, text);
    }
  },

  // 降级：复制链接
  fallbackShare(url, text) {
    const fullText = `${text}\n${url}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText)
        .then(() => UIManager.showToast('分享链接已复制到剪贴板！'))
        .catch(() => this.legacyCopy(fullText));
    } else {
      this.legacyCopy(fullText);
    }
  },

  legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      UIManager.showToast('分享内容已复制！');
    } catch (e) {
      UIManager.showToast('请手动复制链接分享');
    }
    document.body.removeChild(ta);
  }
};

/* ==========================================
   平台生成器 - 生成圆柱各层平台数据
   ========================================== */
const PlatformGenerator = {
  // 上一层的缺口角度集合（用于实现对齐缺口）
  lastLayerGapAngles: [],

  reset() {
    this.lastLayerGapAngles = [];
  },

  /**
   * 生成单层平台数据
   * @param {number} layerIndex - 当前层索引（从0开始）
   * @param {string} difficulty - 难度类型 'newbie'|'expert'
   * @param {number} totalLayersGenerated - 已生成的总层数
   * @returns {Object} 平台数据对象
   */
  generateLayer(layerIndex, difficulty, totalLayersGenerated) {
    const cfg = CONFIG.DIFFICULTY[difficulty];

    // 计算当前难度系数（随层数递增）
    const dangerRatio = Math.min(
      cfg.initialDangerRatio + Math.floor(totalLayersGenerated / cfg.difficultyIncreaseInterval) * cfg.difficultyIncreaseAmount,
      cfg.maxDangerRatio
    );

    // 缺口数量
    const gapCount = Math.floor(
      cfg.gapCount[0] + Math.random() * (cfg.gapCount[1] - cfg.gapCount[0] + 1)
    );

    // 缺口宽度（随难度增加而减小）
    const baseGapAngle = cfg.gapAngle[0] + (cfg.gapAngle[1] - cfg.gapAngle[0]) * (1 - dangerRatio);
    const gapAngle = Math.max(20, baseGapAngle + (Math.random() - 0.5) * 12);

    // 决定是否对齐上层缺口（影响连击）
    const shouldAlign = this.lastLayerGapAngles.length > 0 &&
                        Math.random() < cfg.alignedGapProbability;

    // 生成缺口起始角度
    const gaps = [];
    if (shouldAlign && this.lastLayerGapAngles.length > 0) {
      // 继承上层部分缺口（允许连续下落）
      const alignCount = Math.min(1, this.lastLayerGapAngles.length);
      for (let i = 0; i < alignCount; i++) {
        const base = this.lastLayerGapAngles[i] + (Math.random() - 0.5) * 15;
        gaps.push(((base % 360) + 360) % 360);
      }
      // 补充随机缺口
      while (gaps.length < gapCount) {
        const angle = Math.random() * 360;
        if (!this._tooClose(angle, gaps, gapAngle)) {
          gaps.push(angle);
        }
      }
    } else {
      // 纯随机缺口分布
      let attempts = 0;
      while (gaps.length < gapCount && attempts < 100) {
        const angle = Math.random() * 360;
        if (!this._tooClose(angle, gaps, gapAngle)) {
          gaps.push(angle);
        }
        attempts++;
      }
    }

    this.lastLayerGapAngles = [...gaps];

    // 生成板块数据（将360°分割成扇形板块，缺口处留空）
    const segments = this._buildSegments(gaps, gapAngle, dangerRatio, difficulty);

    // 决定是否生成橙色立墙
    const wallProbability = totalLayersGenerated >= cfg.wallLateStartLayer
      ? cfg.wallProbabilityLate
      : cfg.wallProbabilityEarly;
    const hasWall = Math.random() < wallProbability;
    const wallAngle = hasWall ? Math.random() * 360 : null;
    // 立墙不能放在缺口处
    const wallAngleFinal = hasWall && !this._isInGap(wallAngle, gaps, gapAngle)
      ? wallAngle : null;

    return {
      layerIndex,
      segments,      // 扇形板块数组
      gaps,          // 缺口角度数组
      gapAngle,      // 缺口宽度（度）
      wallAngle: wallAngleFinal, // 橙色立墙角度（null=无）
      dangerRatio,   // 当前层危险度
      y: 0           // Y坐标（由渲染器赋值）
    };
  },

  // 将缺口转换为实体板块数据
  _buildSegments(gaps, gapAngle, dangerRatio, difficulty) {
    const segments = [];
    // 将所有角度范围标记为板块或缺口
    // 先构建完整360°，再切除缺口
    const sortedGaps = [...gaps].sort((a, b) => a - b);

    // 构建实体区域（非缺口区域）
    const solidRanges = this._getSolidRanges(sortedGaps, gapAngle);

    solidRanges.forEach(range => {
      const isDanger = Math.random() < dangerRatio;
      segments.push({
        startAngle: range.start,
        endAngle: range.end,
        isDanger,
        // 预计算弧度（渲染用）
        startRad: (range.start - 90) * Math.PI / 180,
        endRad: (range.end - 90) * Math.PI / 180
      });
    });

    return segments;
  },

  // 获取实体范围（排除缺口）
  _getSolidRanges(sortedGaps, gapAngle) {
    const halfGap = gapAngle / 2;
    const excluded = []; // 缺口范围（归一化到0-360）

    sortedGaps.forEach(gapCenter => {
      let start = ((gapCenter - halfGap) % 360 + 360) % 360;
      let end = ((gapCenter + halfGap) % 360 + 360) % 360;
      excluded.push({ start, end, wraps: end < start });
    });

    // 从0°到360°，剔除缺口区域，得到实体范围
    const points = new Set([0, 360]);
    excluded.forEach(e => {
      if (e.wraps) {
        points.add(e.start);
        points.add(360);
        points.add(0);
        points.add(e.end);
      } else {
        points.add(e.start);
        points.add(e.end);
      }
    });

    const sorted = [...points].sort((a, b) => a - b);
    const ranges = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const start = sorted[i];
      const end = sorted[i + 1];
      if (end - start < 2) continue; // 忽略极小片段

      const mid = (start + end) / 2;
      // 检查中点是否在缺口内
      if (!this._isInGap(mid, sortedGaps, gapAngle)) {
        ranges.push({ start, end });
      }
    }

    return ranges;
  },

  _tooClose(angle, existing, gapAngle) {
    return existing.some(g => {
      let diff = Math.abs(angle - g) % 360;
      if (diff > 180) diff = 360 - diff;
      return diff < gapAngle * 1.5;
    });
  },

  _isInGap(angle, gaps, gapAngle) {
    const halfGap = gapAngle / 2;
    return gaps.some(g => {
      let diff = Math.abs(angle - g) % 360;
      if (diff > 180) diff = 360 - diff;
      return diff < halfGap;
    });
  }
};

/* ==========================================
   物理引擎 - 小球碰撞与运动计算
   ========================================== */
const PhysicsEngine = {
  /**
   * 更新小球物理状态
   * @param {Object} ball - 小球对象
   * @param {Array} platforms - 平台数组
   * @param {number} cylinderRadius - 圆柱半径
   * @param {number} centerX - 圆柱中心X
   * @param {number} ballScreenY - 小球屏幕Y坐标（固定）
   * @param {number} currentRotation - 当前旋转角度
   * @returns {Object} 碰撞结果
   */
  update(ball, platforms, cylinderRadius, centerX, ballScreenY, currentRotation) {
    // 更新速度（重力）
    ball.vy += CONFIG.GRAVITY;
    if (ball.vy > CONFIG.MAX_FALL_SPEED) ball.vy = CONFIG.MAX_FALL_SPEED;

    // 更新小球相对Y位置（在世界坐标中，相对于场景）
    ball.worldY += ball.vy;

    // 碰撞结果
    const result = {
      hitNormal: false,  // 碰到普通板块
      hitDanger: false,  // 碰到危险板块/立墙
      layerPassed: -1,   // 穿过的层索引（-1=未穿过）
      landedOnLayer: -1  // 落地层索引（-1=未落地）
    };

    // 检测与所有平台的碰撞
    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i];
      const platformWorldY = platform.worldY; // 平台在世界坐标的Y值

      // 平台厚度范围
      const platTop = platformWorldY;
      const platBottom = platformWorldY + CONFIG.PLATFORM_HEIGHT;

      // 小球底部Y（在世界坐标中）
      const ballBottom = ball.worldY + CONFIG.BALL_RADIUS;
      const ballTop = ball.worldY - CONFIG.BALL_RADIUS;

      // 检测小球是否在平台高度范围内（向下落时）
      if (ball.vy > 0 && ballBottom >= platTop && ballBottom <= platBottom + ball.vy + 2) {
        // 计算小球在圆柱上的角度（考虑旋转）
        const ballAngle = ((currentRotation % 360) + 360) % 360;

        // 检查该角度是否在某个板块上
        const hitSegment = this._getSegmentAt(platform, ballAngle);

        if (hitSegment) {
          // 命中了某个板块
          ball.worldY = platTop - CONFIG.BALL_RADIUS; // 修正位置防穿模
          ball.vy = -Math.abs(ball.vy) * CONFIG.BOUNCE_FACTOR;

          // 防止无限微弹
          if (Math.abs(ball.vy) < Math.abs(CONFIG.MIN_BOUNCE_VY)) {
            ball.vy = CONFIG.MIN_BOUNCE_VY;
          }

          if (hitSegment.isDanger) {
            result.hitDanger = true;
          } else {
            result.hitNormal = true;
            result.landedOnLayer = i;
          }
          break;
        } else {
          // 在缺口处，小球穿过该层
          // 检查是否刚穿过这层（防重复计算）
          if (!platform.passed) {
            platform.passed = true;
            result.layerPassed = i;
          }
        }
      }

      // 检测橙色立墙碰撞
      if (platform.wallAngle !== null) {
        const wallResult = this._checkWallCollision(ball, platform, ballAngle, currentRotation);
        if (wallResult) {
          result.hitDanger = true;
          break;
        }
      }
    }

    return result;
  },

  // 获取指定角度的板块（考虑旋转后的世界角度）
  _getSegmentAt(platform, worldAngle) {
    for (const seg of platform.segments) {
      let start = seg.startAngle;
      let end = seg.endAngle;

      if (end > start) {
        if (worldAngle >= start && worldAngle <= end) return seg;
      } else {
        // 跨越0°
        if (worldAngle >= start || worldAngle <= end) return seg;
      }
    }
    return null;
  },

  // 检测立墙碰撞
  _checkWallCollision(ball, platform, ballAngle, currentRotation) {
    if (platform.wallAngle === null) return false;

    // 立墙的世界角度（随平台旋转）
    const wallWorldAngle = ((platform.wallAngle + currentRotation) % 360 + 360) % 360;
    let diff = Math.abs(ballAngle - wallWorldAngle) % 360;
    if (diff > 180) diff = 360 - diff;

    // 立墙宽度约8度，小球进入此范围视为碰撞
    const wallThreshold = 8;

    // 检查小球是否在立墙高度范围内
    const wallTop = platform.worldY - CONFIG.PLATFORM_LAYER_HEIGHT * CONFIG.WALL_HEIGHT_RATIO;
    const wallBottom = platform.worldY;
    const ballY = ball.worldY;

    if (diff < wallThreshold && ballY > wallTop && ballY < wallBottom) {
      return true;
    }
    return false;
  }
};

/* ==========================================
   游戏渲染器 - Canvas绘制
   ========================================== */
const GameRenderer = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  centerX: 0,
  centerY: 0,
  cylinderRadius: 0,

  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    // 使用实际像素尺寸，支持高清屏
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    this.ctx.scale(dpr, dpr);
    this.width = w;
    this.height = h;
    this.centerX = w / 2;
    // 小球固定在屏幕上方40%处
    this.ballScreenY = h * 0.4;
    this.cylinderRadius = w * CONFIG.CYLINDER_RADIUS_RATIO;
  },

  // 主渲染入口
  render(state) {
    const { ctx, width, height, centerX, ballScreenY, cylinderRadius } = this;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 背景渐变
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, CONFIG.COLORS.backgroundGradientTop);
    grad.addColorStop(1, CONFIG.COLORS.backgroundGradientBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 绘制圆柱背景（无限延伸感）
    this._drawCylinderBackground(cylinderRadius, centerX, height);

    // 绘制所有平台层
    if (state && state.platforms) {
      state.platforms.forEach((platform, i) => {
        // 将世界坐标转换为屏幕坐标
        // 小球固定在ballScreenY，场景向下移动
        const screenY = ballScreenY + (platform.worldY - state.ball.worldY);
        if (screenY > -CONFIG.PLATFORM_LAYER_HEIGHT && screenY < height + CONFIG.PLATFORM_LAYER_HEIGHT) {
          this._drawPlatform(platform, screenY, cylinderRadius, centerX, state.rotation);
        }
      });
    }

    // 绘制小球（固定在屏幕中心水平、固定Y）
    this._drawBall(centerX, ballScreenY);

    // 绘制景深雾气（上下渐变，增强层次感）
    this._drawDepthFog(height, width);
  },

  _drawCylinderBackground(radius, centerX, height) {
    const { ctx } = this;
    // 圆柱两侧边缘线
    ctx.save();
    ctx.strokeStyle = CONFIG.COLORS.cylinderEdge;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 8]);

    // 左边缘
    ctx.beginPath();
    ctx.moveTo(centerX - radius, 0);
    ctx.lineTo(centerX - radius, height);
    ctx.stroke();

    // 右边缘
    ctx.beginPath();
    ctx.moveTo(centerX + radius, 0);
    ctx.lineTo(centerX + radius, height);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();

    // 圆柱内部背景（略深）
    const cylGrad = ctx.createLinearGradient(centerX - radius, 0, centerX + radius, 0);
    cylGrad.addColorStop(0, 'rgba(10,10,20,0.3)');
    cylGrad.addColorStop(0.5, 'rgba(10,10,20,0)');
    cylGrad.addColorStop(1, 'rgba(10,10,20,0.3)');
    ctx.fillStyle = cylGrad;
    ctx.fillRect(centerX - radius, 0, radius * 2, height);
  },

  _drawPlatform(platform, screenY, cylinderRadius, centerX, rotation) {
    const { ctx } = this;
    const platHeight = CONFIG.PLATFORM_HEIGHT;

    // 绘制所有扇形板块（投影为矩形条）
    platform.segments.forEach(seg => {
      // 将扇形板块的角度范围转换为圆柱上的X范围
      // 考虑旋转：实际显示角度 = 板块角度 + 当前旋转
      const rotStart = (seg.startAngle + rotation) % 360;
      const rotEnd = (seg.endAngle + rotation) % 360;

      // 转换为弧度，映射到X坐标（圆柱投影）
      const x1 = this._angleToX(rotStart, centerX, cylinderRadius);
      const x2 = this._angleToX(rotEnd, centerX, cylinderRadius);

      // 正确处理跨越边界的情况
      const segments = this._getDrawSegments(rotStart, rotEnd, centerX, cylinderRadius);

      segments.forEach(({ xa, xb }) => {
        if (Math.abs(xb - xa) < 1) return;

        const left = Math.min(xa, xb);
        const right = Math.max(xa, xb);
        const w = right - left;

        const isD = seg.isDanger;
        const topColor = isD ? CONFIG.COLORS.platformDangerTop : CONFIG.COLORS.platformNormalTop;
        const mainColor = isD ? CONFIG.COLORS.platformDanger : CONFIG.COLORS.platformNormal;
        const edgeColor = isD ? CONFIG.COLORS.platformDangerEdge : CONFIG.COLORS.platformNormalEdge;

        // 顶面（高光）
        ctx.fillStyle = topColor;
        ctx.fillRect(left, screenY, w, platHeight * 0.3);

        // 主体
        ctx.fillStyle = mainColor;
        ctx.fillRect(left, screenY + platHeight * 0.3, w, platHeight * 0.7);

        // 发光边框（危险块更亮）
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = isD ? 1.5 : 1;
        ctx.strokeRect(left + 0.5, screenY + 0.5, w - 1, platHeight - 1);

        // 缺口阴影效果（在板块两端）
        const shadowW = Math.min(8, w * 0.15);
        const shadowGrad = ctx.createLinearGradient(left, 0, left + shadowW, 0);
        shadowGrad.addColorStop(0, CONFIG.COLORS.gapShadow);
        shadowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(left, screenY, shadowW, platHeight);

        const shadowGrad2 = ctx.createLinearGradient(right - shadowW, 0, right, 0);
        shadowGrad2.addColorStop(0, 'transparent');
        shadowGrad2.addColorStop(1, CONFIG.COLORS.gapShadow);
        ctx.fillStyle = shadowGrad2;
        ctx.fillRect(right - shadowW, screenY, shadowW, platHeight);
      });
    });

    // 绘制橙色立墙
    if (platform.wallAngle !== null) {
      this._drawWall(platform, screenY, cylinderRadius, centerX, rotation);
    }
  },

  // 将角度（考虑旋转后）转为屏幕X坐标
  _angleToX(angle, centerX, radius) {
    // 角度0°=正上方，投影到X轴
    const rad = (angle - 90) * Math.PI / 180;
    return centerX + Math.sin(rad) * radius;
  },

  // 处理板块跨越圆柱边界的分段绘制
  _getDrawSegments(rotStart, rotEnd, centerX, radius) {
    const x1 = this._angleToX(rotStart, centerX, radius);
    const x2 = this._angleToX(rotEnd, centerX, radius);
    const left = centerX - radius;
    const right = centerX + radius;

    // 简化处理：直接返回两端X坐标，限制在圆柱范围内
    const xa = Math.max(left, Math.min(right, x1));
    const xb = Math.max(left, Math.min(right, x2));

    // 判断板块是否跨越了圆柱的正面/背面
    // 这里用简单投影，背面板块（-90°到90°）正常显示
    const arcLen = Math.abs(rotEnd - rotStart);
    if (arcLen > 180) {
      // 大弧段，需要分两段
      const midX = centerX;
      return [
        { xa: Math.max(left, Math.min(right, xa)), xb: Math.max(left, Math.min(right, midX)) },
        { xa: Math.max(left, Math.min(right, midX)), xb: Math.max(left, Math.min(right, xb)) }
      ];
    }

    return [{ xa, xb }];
  },

  _drawWall(platform, screenY, cylinderRadius, centerX, rotation) {
    const { ctx } = this;
    const wallWorldAngle = (platform.wallAngle + rotation + 360) % 360;
    const wallX = this._angleToX(wallWorldAngle, centerX, cylinderRadius);

    // 立墙高度
    const wallHeight = CONFIG.PLATFORM_LAYER_HEIGHT * CONFIG.WALL_HEIGHT_RATIO;
    const wallTop = screenY - wallHeight;
    const wallWidth = 8;

    // 立墙主体
    const wallGrad = ctx.createLinearGradient(wallX - wallWidth / 2, 0, wallX + wallWidth / 2, 0);
    wallGrad.addColorStop(0, CONFIG.COLORS.wallDangerEdge);
    wallGrad.addColorStop(0.5, CONFIG.COLORS.wallDanger);
    wallGrad.addColorStop(1, CONFIG.COLORS.wallDangerEdge);
    ctx.fillStyle = wallGrad;
    ctx.fillRect(wallX - wallWidth / 2, wallTop, wallWidth, wallHeight);

    // 立墙顶部高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(wallX - wallWidth / 2, wallTop, wallWidth, 3);
  },

  _drawBall(x, y) {
    const { ctx } = this;
    const r = CONFIG.BALL_RADIUS;

    // 投影阴影
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + r + 2, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 小球主体渐变
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.6, '#e0e0f0');
    grad.addColorStop(1, '#b0b0c8');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // 高光
    ctx.fillStyle = CONFIG.COLORS.ballHighlight;
    ctx.beginPath();
    ctx.ellipse(x - r * 0.28, y - r * 0.28, r * 0.3, r * 0.22, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    // 边框
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  },

  _drawDepthFog(height, width) {
    const { ctx } = this;
    // 顶部雾气
    const topFog = ctx.createLinearGradient(0, 0, 0, height * 0.25);
    topFog.addColorStop(0, 'rgba(15,15,26,0.9)');
    topFog.addColorStop(1, 'transparent');
    ctx.fillStyle = topFog;
    ctx.fillRect(0, 0, width, height * 0.25);

    // 底部雾气
    const bottomFog = ctx.createLinearGradient(0, height * 0.8, 0, height);
    bottomFog.addColorStop(0, 'transparent');
    bottomFog.addColorStop(1, 'rgba(15,15,26,0.7)');
    ctx.fillStyle = bottomFog;
    ctx.fillRect(0, height * 0.8, width, height * 0.2);
  }
};

/* ==========================================
   主游戏引擎
   ========================================== */
const GameEngine = {
  // 游戏状态
  running: false,
  paused: false,
  gameOver: false,
  difficulty: 'newbie',

  // 游戏数据
  score: 0,
  currentCombo: 0,
  maxCombo: 0,
  totalLayersPassed: 0,
  totalLayersGenerated: 0,
  currentLayerStreak: 0, // 当前连续下落层数（计算连击分）

  // 场景状态
  rotation: 0,           // 当前旋转角度（度）
  rotationVelocity: 0,   // 旋转角速度
  scrollOffset: 0,       // 场景滚动偏移

  // 物理对象
  ball: {
    worldY: 0,           // 小球在世界坐标的Y
    vy: 0,               // 垂直速度
    lastLandedLayer: -1  // 上次落地的层索引
  },

  // 平台数据
  platforms: [],

  // 帧率控制
  lastTime: 0,
  animFrameId: null,

  init(difficulty) {
    this.difficulty = difficulty;
    this.score = 0;
    this.currentCombo = 0;
    this.maxCombo = 0;
    this.totalLayersPassed = 0;
    this.totalLayersGenerated = 0;
    this.currentLayerStreak = 0;
    this.rotation = 0;
    this.rotationVelocity = 0;
    this.scrollOffset = 0;
    this.running = false;
    this.paused = false;
    this.gameOver = false;

    // 重置小球（从屏幕上方开始下落）
    this.ball = {
      worldY: -200,  // 世界坐标初始Y，高于第一层平台
      vy: 0,
      lastLandedLayer: -1
    };

    // 重置平台生成器
    PlatformGenerator.reset();

    // 预生成平台
    this.platforms = [];
    this._generateMorePlatforms(CONFIG.PLATFORM_COUNT + 5);
  },

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.ball.vy = 2; // 初始给一个向下的速度
    this._loop(this.lastTime);
  },

  pause() {
    this.paused = true;
  },

  resume() {
    this.paused = false;
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  },

  stop() {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  },

  // 主循环
  _loop(timestamp) {
    if (!this.running || this.paused || this.gameOver) return;

    const dt = Math.min((timestamp - this.lastTime) / 16.67, 3); // 帧时间比（目标60fps）
    this.lastTime = timestamp;

    this._update(dt);
    this._render();

    this.animFrameId = requestAnimationFrame(ts => this._loop(ts));
  },

  _update(dt) {
    // 更新旋转（加入惯性）
    this.rotationVelocity *= CONFIG.ROTATION_FRICTION;
    this.rotation += this.rotationVelocity;
    this.rotation = ((this.rotation % 360) + 360) % 360;

    // 同步平台worldY到球的世界坐标（实现"场景下移"的视觉效果）
    // 平台世界Y是固定的，球的worldY随物理更新
    // 场景滚动速度随分数递增
    const scrollSpeed = Math.min(
      CONFIG.SCROLL_SPEED_BASE + this.score * 0.002,
      CONFIG.SCROLL_SPEED_MAX
    );

    // 物理更新
    const physResult = PhysicsEngine.update(
      this.ball,
      this.platforms,
      GameRenderer.cylinderRadius,
      GameRenderer.centerX,
      GameRenderer.ballScreenY,
      this.rotation
    );

    // 处理碰撞结果
    if (physResult.hitDanger) {
      this._triggerGameOver();
      return;
    }

    if (physResult.hitNormal) {
      // 落地：当前连击归零（停在平台上等待下一次掉落）
      // 连击在穿过缺口时计算
      if (this.ball.lastLandedLayer !== physResult.landedOnLayer) {
        this.ball.lastLandedLayer = physResult.landedOnLayer;
        // 重置当前层连续下落计数
        this.currentLayerStreak = 0;
      }
    }

    if (physResult.layerPassed >= 0) {
      // 穿过一层缺口
      this.currentLayerStreak++;
      this.totalLayersPassed++;

      // 计算得分（3的n-1次方，上限36）
      const streakScore = Math.min(
        Math.pow(CONFIG.COMBO_SCORE_BASE, this.currentLayerStreak - 1),
        CONFIG.COMBO_SCORE_CAP
      );
      this.score += Math.floor(streakScore);
      this.currentCombo = this.currentLayerStreak;
      if (this.currentCombo > this.maxCombo) this.maxCombo = this.currentCombo;

      // 连击动画（连击≥2时显示）
      if (this.currentLayerStreak >= 2) {
        UIManager.showComboPopup(this.currentLayerStreak, Math.floor(streakScore));
      }

      // 更新HUD
      UIManager.updateHUD(this.score, this.currentCombo);
    }

    // 补充新平台（确保屏幕下方始终有平台）
    const lowestPlatY = this.platforms.length > 0
      ? this.platforms[this.platforms.length - 1].worldY
      : 0;

    if (lowestPlatY - this.ball.worldY < GameRenderer.height * 1.5) {
      this._generateMorePlatforms(5);
    }

    // 清理已经滚出屏幕上方的平台
    const removeCount = this.platforms.findIndex(p =>
      (p.worldY - this.ball.worldY) + GameRenderer.ballScreenY > GameRenderer.height + CONFIG.PLATFORM_LAYER_HEIGHT * 2
    );
    if (removeCount > 0) {
      this.platforms.splice(0, removeCount);
    }
  },

  _render() {
    GameRenderer.render({
      platforms: this.platforms,
      ball: this.ball,
      rotation: this.rotation
    });
  },

  _generateMorePlatforms(count) {
    for (let i = 0; i < count; i++) {
      const worldY = this.totalLayersGenerated === 0
        ? GameRenderer.ballScreenY * 0.5  // 第一层在小球下方
        : (this.platforms.length > 0
          ? this.platforms[this.platforms.length - 1].worldY + CONFIG.PLATFORM_LAYER_HEIGHT
          : 0);

      const layerData = PlatformGenerator.generateLayer(
        this.totalLayersGenerated,
        this.difficulty,
        this.totalLayersGenerated
      );
      layerData.worldY = worldY + CONFIG.PLATFORM_LAYER_HEIGHT * (this.totalLayersGenerated === 0 ? 1 : 0);

      if (this.platforms.length > 0) {
        layerData.worldY = this.platforms[this.platforms.length - 1].worldY + CONFIG.PLATFORM_LAYER_HEIGHT;
      } else {
        // 第一层：放在小球初始位置下方合适距离
        layerData.worldY = this.ball.worldY + 180;
      }

      layerData.passed = false;
      this.platforms.push(layerData);
      this.totalLayersGenerated++;
    }
  },

  _triggerGameOver() {
    this.running = false;
    this.gameOver = true;
    cancelAnimationFrame(this.animFrameId);

    // 死亡效果
    UIManager.showDeathFlash();

    // 保存成绩
    const username = StorageManager.getUsername();
    const isNewRecord = StorageManager.saveHighScore(this.score);
    StorageManager.updateRanking(username, this.score, this.difficulty);

    // 延迟显示结算弹窗（等待死亡动画）
    setTimeout(() => {
      App.showGameOver(this.score, this.maxCombo, isNewRecord);
    }, 600);
  },

  // 接受旋转输入
  applyRotation(delta) {
    this.rotationVelocity = Math.max(
      -CONFIG.MAX_ROTATION_SPEED,
      Math.min(CONFIG.MAX_ROTATION_SPEED, this.rotationVelocity + delta)
    );
  }
};

/* ==========================================
   输入处理器 - 触摸与鼠标事件
   ========================================== */
const InputHandler = {
  touchStartX: 0,
  touchLastX: 0,
  isDragging: false,

  init() {
    const canvas = document.getElementById('gameCanvas');

    // 触摸事件（手机端）
    canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });

    // 鼠标事件（PC端调试）
    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
  },

  _onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      this.touchStartX = e.touches[0].clientX;
      this.touchLastX = this.touchStartX;
      this.isDragging = true;
    }
  },

  _onTouchMove(e) {
    e.preventDefault();
    if (!this.isDragging || !GameEngine.running || GameEngine.paused) return;
    if (e.touches.length > 0) {
      const x = e.touches[0].clientX;
      const delta = (x - this.touchLastX) * CONFIG.TOUCH_SENSITIVITY;
      // 将像素移动转换为旋转角度
      const rotDelta = delta / GameRenderer.width * 360 * 0.8;
      GameEngine.applyRotation(rotDelta);
      this.touchLastX = x;
    }
  },

  _onTouchEnd(e) {
    e.preventDefault();
    this.isDragging = false;
  },

  _onMouseDown(e) {
    this.touchStartX = e.clientX;
    this.touchLastX = this.touchStartX;
    this.isDragging = true;
  },

  _onMouseMove(e) {
    if (!this.isDragging || !GameEngine.running || GameEngine.paused) return;
    const delta = (e.clientX - this.touchLastX) * CONFIG.TOUCH_SENSITIVITY;
    const rotDelta = delta / GameRenderer.width * 360 * 0.8;
    GameEngine.applyRotation(rotDelta);
    this.touchLastX = e.clientX;
  },

  _onMouseUp(e) {
    this.isDragging = false;
  }
};

/* ==========================================
   应用主控制器
   ========================================== */
const App = {
  currentDifficulty: 'newbie',
  currentUsername: '',

  init() {
    // 初始化渲染器
    GameRenderer.init();

    // 初始化输入
    InputHandler.init();

    // 绑定所有UI事件
    this._bindEvents();

    // 检查URL分享参数
    this._handleShareParams();

    // 检查是否有已存储的用户信息
    if (StorageManager.hasUser()) {
      this.currentUsername = StorageManager.getUsername();
      this.currentDifficulty = StorageManager.getDifficulty();
      this._showHome();
    } else {
      // 首次进入：显示欢迎弹窗
      UIManager.show('welcomeModal');
    }

    // 添加横屏提示
    this._addLandscapeTip();

    // 渲染一帧背景（避免进入时空白）
    GameRenderer.render(null);
  },

  _bindEvents() {
    // === 欢迎弹窗 ===
    document.getElementById('btnExpert').addEventListener('click', () => {
      this.currentDifficulty = 'expert';
      UIManager.hide('welcomeModal');
      UIManager.show('usernameModal');
      setTimeout(() => document.getElementById('usernameInput').focus(), 300);
    });

    document.getElementById('btnNewbie').addEventListener('click', () => {
      this.currentDifficulty = 'newbie';
      UIManager.hide('welcomeModal');
      UIManager.show('usernameModal');
      setTimeout(() => document.getElementById('usernameInput').focus(), 300);
    });

    // === 用户名弹窗 ===
    document.getElementById('btnConfirmUsername').addEventListener('click', () => {
      this._confirmUsername();
    });

    document.getElementById('usernameInput').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') this._confirmUsername();
    });

    // === 游戏结算弹窗 ===
    document.getElementById('btnRestart').addEventListener('click', () => {
      UIManager.hide('gameOverModal');
      this._startGame(this.currentDifficulty);
    });

    document.getElementById('btnSurrender').addEventListener('click', () => {
      // 切换到萌新模式
      this.currentDifficulty = 'newbie';
      StorageManager.set(StorageManager.KEYS.DIFFICULTY, 'newbie');
      UIManager.hide('gameOverModal');
      UIManager.showToast(CONFIG.TEXT.surrenderSwitchMsg, 3000);
      setTimeout(() => this._startGame('newbie'), 500);
    });

    document.getElementById('btnShowRanking').addEventListener('click', () => {
      UIManager.renderRanking(this.currentUsername);
      UIManager.hide('gameOverModal');
      UIManager.show('rankingModal');
    });

    document.getElementById('btnShare').addEventListener('click', () => {
      ShareManager.share(
        this.currentUsername,
        parseInt(document.getElementById('finalScore').textContent, 10),
        this.currentDifficulty
      );
    });

    // === 排行榜弹窗 ===
    document.getElementById('btnCloseRanking').addEventListener('click', () => {
      UIManager.hide('rankingModal');
    });

    // === 首页 ===
    document.getElementById('btnStartGame').addEventListener('click', () => {
      UIManager.hide('homeScreen');
      this._startGame(this.currentDifficulty);
    });

    document.getElementById('btnHomeRanking').addEventListener('click', () => {
      UIManager.renderRanking(this.currentUsername);
      UIManager.show('rankingModal');
    });

    document.getElementById('btnResetUser').addEventListener('click', () => {
      if (confirm('确认切换用户？当前账户数据不会丢失。')) {
        StorageManager.clearUser();
        UIManager.hide('homeScreen');
        UIManager.show('welcomeModal');
      }
    });

    // === 暂停弹窗 ===
    document.getElementById('pauseBtn').addEventListener('click', () => {
      if (GameEngine.running && !GameEngine.paused) {
        GameEngine.pause();
        UIManager.show('pauseModal');
      }
    });

    document.getElementById('btnResume').addEventListener('click', () => {
      UIManager.hide('pauseModal');
      GameEngine.resume();
    });

    document.getElementById('btnQuit').addEventListener('click', () => {
      UIManager.hide('pauseModal');
      GameEngine.stop();
      UIManager.hide('hud');
      this._showHome();
    });

    // 防止弹窗背景滚动
    document.querySelectorAll('.modal-overlay').forEach(el => {
      el.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    });
  },

  _confirmUsername() {
    const input = document.getElementById('usernameInput');
    const errEl = document.getElementById('usernameError');
    const name = input.value.trim();

    if (!name) {
      errEl.classList.remove('hidden');
      input.focus();
      return;
    }

    errEl.classList.add('hidden');
    this.currentUsername = name;

    // 保存到本地存储
    StorageManager.set(StorageManager.KEYS.USERNAME, name);
    StorageManager.set(StorageManager.KEYS.DIFFICULTY, this.currentDifficulty);

    UIManager.hide('usernameModal');
    this._startGame(this.currentDifficulty);
  },

  _showHome() {
    const welcome = document.getElementById('homeWelcome');
    const diffLabel = CONFIG.DIFFICULTY[this.currentDifficulty]?.label || '';
    welcome.textContent = `欢迎回来，${this.currentUsername}！当前模式：${diffLabel}`;

    UIManager.show('homeScreen');
  },

  _startGame(difficulty) {
    this.currentDifficulty = difficulty;
    StorageManager.set(StorageManager.KEYS.DIFFICULTY, difficulty);

    UIManager.hide('homeScreen');

    // 初始化并启动游戏
    GameEngine.init(difficulty);

    // 显示HUD
    const hud = document.getElementById('hud');
    hud.classList.remove('hidden');
    UIManager.updateHUD(0, 0, this.currentUsername);
    document.getElementById('playerNameDisplay').textContent = this.currentUsername;

    GameEngine.start();
  },

  showGameOver(score, maxCombo, isNewRecord) {
    // 更新结算弹窗内容
    document.getElementById('finalScore').textContent = score;
    document.getElementById('highScore').textContent = StorageManager.getHighScore();
    document.getElementById('maxCombo').textContent = maxCombo;

    // 根据难度显示不同文案
    const topText = this.currentDifficulty === 'expert'
      ? CONFIG.TEXT.expertTopText
      : CONFIG.TEXT.newbieTopText;
    document.getElementById('gameOverTopText').textContent = topText;

    // 高玩模式显示"认输"按钮
    const surrenderBtn = document.getElementById('btnSurrender');
    if (this.currentDifficulty === 'expert') {
      surrenderBtn.classList.remove('hidden');
    } else {
      surrenderBtn.classList.add('hidden');
    }

    if (isNewRecord && score > 0) {
      UIManager.showToast('🎉 新纪录！', 2000);
    }

    UIManager.hide('hud');
    UIManager.show('gameOverModal');
  },

  // 处理分享链接参数
  _handleShareParams() {
    const shareData = ShareManager.parseShareParams();
    if (shareData && shareData.name && shareData.score > 0) {
      // 保存好友成绩
      StorageManager.saveFriendScore(shareData);
      // 清除URL参数（避免重复处理）
      const cleanUrl = window.location.href.split('?')[0];
      window.history.replaceState({}, '', cleanUrl);
      // 延迟提示
      setTimeout(() => {
        UIManager.showToast(`好友 ${shareData.name} 的得分：${shareData.score}分 已收录`, 3000);
      }, 1500);
    }
  },

  _addLandscapeTip() {
    const tip = document.createElement('div');
    tip.id = 'landscape-tip';
    tip.innerHTML = `<div class="tip-icon">📱</div><p>请竖屏游玩，效果更佳</p>`;
    document.body.appendChild(tip);
  }
};

/* ==========================================
   启动应用
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// 处理页面可见性变化（切换到后台时暂停）
document.addEventListener('visibilitychange', () => {
  if (document.hidden && GameEngine.running && !GameEngine.paused) {
    GameEngine.pause();
    UIManager.show('pauseModal');
  }
});

// 阻止iOS上的双击缩放
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });
