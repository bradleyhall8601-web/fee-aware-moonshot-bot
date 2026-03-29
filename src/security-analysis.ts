// src/security-analysis.ts
// Intelligent security analysis for rug pull detection and token quality scoring

import telemetryLogger from './telemetry';

export interface SecurityAnalysis {
  overallScore: number; // 0-100, higher is safer
  riskLevel: 'SAFE' | 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' | 'CRITICAL';
  checks: SecurityCheck[];
  redFlags: string[];
  greenFlags: string[];
  confidence: number; // 0-100
  recommendation: string;
}

export interface SecurityCheck {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  score: number; // 0-100
  description: string;
}

class SecurityAnalyzer {
  /**
   * Comprehensive security analysis for a token
   */
  static analyzeToken(tokenData: any): SecurityAnalysis {
    const checks: SecurityCheck[] = [];
    const redFlags: string[] = [];
    const greenFlags: string[] = [];

    // Run all security checks
    checks.push(this.checkLiquidityLock(tokenData));
    checks.push(this.checkOwnershipStatus(tokenData));
    checks.push(this.checkSupplyDistribution(tokenData));
    checks.push(this.checkTradeHistory(tokenData));
    checks.push(this.checkHolderConcentration(tokenData));
    checks.push(this.checkTokenAge(tokenData));
    checks.push(this.checkVolumePattern(tokenData));
    checks.push(this.checkDeveloperBehavior(tokenData));
    checks.push(this.checkPriceRecency(tokenData));
    checks.push(this.checkEmergencyWithdraw(tokenData));

    // Collect red and green flags
    checks.forEach(check => {
      if (check.status === 'FAIL') {
        redFlags.push(`❌ ${check.name}: ${check.description}`);
      } else if (check.status === 'PASS' && check.score > 80) {
        greenFlags.push(`✅ ${check.name}: ${check.description}`);
      }
    });

    // Calculate overall score
    const avgScore = checks.reduce((sum, c) => sum + c.score, 0) / checks.length;
    const overallScore = Math.round(avgScore);

    // Determine risk level
    const riskLevel = this.determineRiskLevel(overallScore, redFlags.length);

    // Calculate confidence
    const confidence = this.calculateConfidence(tokenData);

    // Generate recommendation
    const recommendation = this.generateRecommendation(overallScore, riskLevel, redFlags);

    return {
      overallScore,
      riskLevel,
      checks,
      redFlags,
      greenFlags,
      confidence,
      recommendation,
    };
  }

  /**
   * Check if liquidity is locked (prevents instant rug pulls)
   */
  static checkLiquidityLock(tokenData: any): SecurityCheck {
    const liquidity = tokenData.liquidity || 0;
    const isLocked = tokenData.liquidityLocked === true;
    const lockTime = tokenData.lockTime || 0;

    if (isLocked && lockTime > Date.now() + 86400000) {
      // Locked for >24 hours
      return {
        name: 'Liquidity Lock',
        status: 'PASS',
        score: 95,
        description: 'Liquidity locked for extended period, low rug pull risk',
      };
    } else if (isLocked) {
      return {
        name: 'Liquidity Lock',
        status: 'WARN',
        score: 60,
        description: 'Liquidity locked but for limited time',
      };
    } else if (liquidity > 50000) {
      return {
        name: 'Liquidity Lock',
        status: 'WARN',
        score: 40,
        description: 'High liquidity but not locked - easier to rug',
      };
    }

    return {
      name: 'Liquidity Lock',
      status: 'FAIL',
      score: 10,
      description: 'No liquidity lock detected - HIGH RUG RISK',
    };
  }

  /**
   * Check ownership and renouncement
   */
  static checkOwnershipStatus(tokenData: any): SecurityCheck {
    const ownershipRenounced = tokenData.ownershipRenounced === true;
    const ownerMultisig = tokenData.ownerMultisig === true;

    if (ownershipRenounced) {
      return {
        name: 'Ownership',
        status: 'PASS',
        score: 95,
        description: 'Ownership renounced - no single point of failure',
      };
    } else if (ownerMultisig) {
      return {
        name: 'Ownership',
        status: 'PASS',
        score: 85,
        description: 'Multisig ownership - requires multiple signatures',
      };
    }

    return {
      name: 'Ownership',
      status: 'WARN',
      score: 50,
      description: 'Single owner with ability to modify contract',
    };
  }

  /**
   * Check supply distribution and team allocation
   */
  static checkSupplyDistribution(tokenData: any): SecurityCheck {
    const teamAllocation = tokenData.teamAllocation || 0;
    const burnPercentage = tokenData.burnPercentage || 0;
    const devWallet = tokenData.devWallet || 0;

    let score = 50;
    let description = 'Supply distribution: ';

    if (teamAllocation > 40) {
      return {
        name: 'Supply Distribution',
        status: 'FAIL',
        score: 20,
        description: `Team holdings too high (${teamAllocation}%) - high dump risk`,
      };
    }

    if (burnPercentage > 30) {
      score += 20;
      description += `${burnPercentage}% burned (good), `;
    }

    if (devWallet > 0 && devWallet < 10) {
      score += 15;
      description += `Reasonable dev allocation (${devWallet}%)`;
    }

    const status = score > 70 ? 'PASS' : score > 50 ? 'WARN' : 'FAIL';

    return {
      name: 'Supply Distribution',
      status,
      score: Math.min(score, 100),
      description,
    };
  }

  /**
   * Check trading history for wash trading patterns
   */
  static checkTradeHistory(tokenData: any): SecurityCheck {
    const volume24h = tokenData.volume24h || 0;
    const txCount = tokenData.txCount24h || 0;
    const uniqueTraders = tokenData.uniqueTraders24h || 0;
    const avgTxSize = txCount > 0 ? volume24h / txCount : 0;

    // Check for wash trading (few traders with large consistent sizes)
    const traderRatio = uniqueTraders / (txCount || 1);

    if (traderRatio > 0.3 && txCount > 100) {
      // Good: many different traders
      return {
        name: 'Trading Activity',
        status: 'PASS',
        score: 85,
        description: `Healthy trading: ${uniqueTraders} traders, ${txCount} tx in 24h`,
      };
    } else if (txCount > 50) {
      return {
        name: 'Trading Activity',
        status: 'WARN',
        score: 60,
        description: `Limited trader diversity: ${uniqueTraders} traders, ${txCount} tx`,
      };
    }

    return {
      name: 'Trading Activity',
      status: 'WARN',
      score: 40,
      description: 'Low trading activity - could indicate wash trading',
    };
  }

  /**
   * Check holder concentration (whale risk)
   */
  static checkHolderConcentration(tokenData: any): SecurityCheck {
    const topHolderPct = tokenData.topHolderPct || 0;
    const top10HolderPct = tokenData.top10HolderPct || 0;

    if (topHolderPct > 50) {
      return {
        name: 'Holder Concentration',
        status: 'FAIL',
        score: 15,
        description: `Top holder has ${topHolderPct}% - extreme whale risk`,
      };
    } else if (top10HolderPct > 70) {
      return {
        name: 'Holder Concentration',
        status: 'WARN',
        score: 40,
        description: `Top 10 holders have ${top10HolderPct}% - significant dump risk`,
      };
    } else if (top10HolderPct < 50) {
      return {
        name: 'Holder Concentration',
        status: 'PASS',
        score: 85,
        description: `Good distribution: top 10 holders ${top10HolderPct}%`,
      };
    }

    return {
      name: 'Holder Concentration',
      status: 'WARN',
      score: 55,
      description: `Moderate concentration: top 10 at ${top10HolderPct}%`,
    };
  }

  /**
   * Check token age (prevents honeypots)
   */
  static checkTokenAge(tokenData: any): SecurityCheck {
    const ageHours = tokenData.ageHours || 0;
    const ageMinutes = ageHours * 60;

    if (ageHours < 1) {
      return {
        name: 'Token Age',
        status: 'FAIL',
        score: 5,
        description: `Brand new (${ageMinutes.toFixed(0)} min) - extreme honeypot risk`,
      };
    } else if (ageHours < 6) {
      return {
        name: 'Token Age',
        status: 'WARN',
        score: 40,
        description: `Very young (${ageHours.toFixed(1)} hours) - research carefully`,
      };
    } else if (ageHours < 24) {
      return {
        name: 'Token Age',
        status: 'WARN',
        score: 70,
        description: `New token (${ageHours.toFixed(1)} hours) - some history available`,
      };
    } else if (ageHours < 168) {
      // Less than 1 week
      return {
        name: 'Token Age',
        status: 'PASS',
        score: 80,
        description: `Established enough (${(ageHours / 24).toFixed(1)} days)`,
      };
    }

    return {
      name: 'Token Age',
      status: 'PASS',
      score: 95,
      description: `Well-established (${(ageHours / 24).toFixed(0)} days old)`,
    };
  }

  /**
   * Check volume pattern for manipulation
   */
  static checkVolumePattern(tokenData: any): SecurityCheck {
    const volume24h = tokenData.volume24h || 0;
    const volume7d = tokenData.volume7d || 0;
    const liquidity = tokenData.liquidity || 1;
    const volumeLiquiRatio = volume24h / liquidity;

    if (volumeLiquiRatio > 10) {
      return {
        name: 'Volume Pattern',
        status: 'WARN',
        score: 60,
        description: `Very high volume ratio (${volumeLiquiRatio.toFixed(1)}x) - possible manipulation`,
      };
    } else if (volumeLiquiRatio > 5) {
      return {
        name: 'Volume Pattern',
        status: 'WARN',
        score: 70,
        description: `High volume ratio (${volumeLiquiRatio.toFixed(1)}x)`,
      };
    } else if (volumeLiquiRatio > 0.5) {
      return {
        name: 'Volume Pattern',
        status: 'PASS',
        score: 85,
        description: `Healthy volume ratio (${volumeLiquiRatio.toFixed(2)}x)`,
      };
    }

    return {
      name: 'Volume Pattern',
      status: 'WARN',
      score: 45,
      description: 'Low volume - illiquid token',
    };
  }

  /**
   * Analyze developer behavior
   */
  static checkDeveloperBehavior(tokenData: any): SecurityCheck {
    const operationsLog = tokenData.operationsLog || [];
    const suspiciousCount = operationsLog.filter((op: any) => op.suspicious).length;
    const developerTransactions = tokenData.developerTransactions || [];
    const hasRugHistory = tokenData.developerHasRugHistory === true;

    if (hasRugHistory) {
      return {
        name: 'Developer',
        status: 'FAIL',
        score: 0,
        description: 'Developer has rug pull history - EXTREME RISK',
      };
    }

    if (suspiciousCount > 0) {
      return {
        name: 'Developer',
        status: 'WARN',
        score: 35,
        description: `${suspiciousCount} suspicious operations detected`,
      };
    }

    return {
      name: 'Developer',
      status: 'PASS',
      score: 80,
      description: 'No suspicious developer activity detected',
    };
  }

  /**
   * Check for emergency withdraw functions (rug vector)
   */
  static checkEmergencyWithdraw(tokenData: any): SecurityCheck {
    const hasEmergencyWithdraw = tokenData.hasEmergencyWithdraw === true;
    const hasKillSwitch = tokenData.hasKillSwitch === true;

    if (hasKillSwitch) {
      return {
        name: 'Emergency Functions',
        status: 'FAIL',
        score: 10,
        description: 'Kill switch found - can instantly disable trading',
      };
    }

    if (hasEmergencyWithdraw) {
      return {
        name: 'Emergency Functions',
        status: 'WARN',
        score: 40,
        description: 'Emergency withdraw function - potential rug vector',
      };
    }

    return {
      name: 'Emergency Functions',
      status: 'PASS',
      score: 90,
      description: 'No emergency withdraw or kill switch functions',
    };
  }

  /**
   * Check price recency
   */
  static checkPriceRecency(tokenData: any): SecurityCheck {
    const priceAge = tokenData.priceAgeSeconds || 0;

    if (priceAge < 60) {
      return {
        name: 'Price Data',
        status: 'PASS',
        score: 95,
        description: 'Price data fresh (< 1 minute)',
      };
    } else if (priceAge < 300) {
      return {
        name: 'Price Data',
        status: 'WARN',
        score: 70,
        description: `Price data ${(priceAge / 60).toFixed(1)} minutes old`,
      };
    }

    return {
      name: 'Price Data',
      status: 'FAIL',
      score: 30,
      description: 'Stale price data - may be inaccurate',
    };
  }

  /**
   * Determine overall risk level
   */
  static determineRiskLevel(
    score: number,
    redFlagCount: number
  ): 'SAFE' | 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' | 'CRITICAL' {
    if (redFlagCount >= 3) {
      return 'CRITICAL';
    } else if (score >= 85 && redFlagCount === 0) {
      return 'SAFE';
    } else if (score >= 70 && redFlagCount <= 1) {
      return 'LOW_RISK';
    } else if (score >= 55 && redFlagCount <= 2) {
      return 'MEDIUM_RISK';
    } else if (score >= 40) {
      return 'HIGH_RISK';
    }

    return 'CRITICAL';
  }

  /**
   * Calculate confidence in analysis (0-100)
   */
  static calculateConfidence(tokenData: any): number {
    let confidence = 50;

    if (tokenData.liquidityLocked !== undefined) confidence += 10;
    if (tokenData.ownershipRenounced !== undefined) confidence += 10;
    if (tokenData.volume24h !== undefined) confidence += 10;
    if (tokenData.topHolderPct !== undefined) confidence += 10;
    if (tokenData.ageHours !== undefined) confidence += 10;

    return Math.min(confidence, 100);
  }

  /**
   * Generate trading recommendation based on security analysis
   */
  static generateRecommendation(score: number, riskLevel: string, redFlags: string[]): string {
    switch (riskLevel) {
      case 'SAFE':
        return '✅ SAFE: Strong security score, good for trading.';
      case 'LOW_RISK':
        return '🟢 LOW RISK: Generally safe, but monitor for changes.';
      case 'MEDIUM_RISK':
        return '🟡 MEDIUM RISK: Acceptable if position size is small.';
      case 'HIGH_RISK':
        return '🔴 HIGH RISK: Only trade with very small position. High caution advised.';
      case 'CRITICAL':
        return `⛔ CRITICAL: DO NOT TRADE. Major red flags detected: ${redFlags.slice(0, 2).join(', ')}`;
      default:
        return 'Unknown risk level';
    }
  }
}

export default SecurityAnalyzer;
