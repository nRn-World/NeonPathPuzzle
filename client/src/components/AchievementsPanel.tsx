import { content } from "@/lib/contentText";
import { useState } from 'react';
import { useAchievements } from '@/hooks/use-achievements';
import { useI18n } from '@/lib/i18n';
import { achievements, getRarityColor, getRarityOrder } from '@/lib/achievements';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Check } from 'lucide-react';

export function AchievementsPanel() {
  const { unlockedAchievements, progress, isUnlocked } = useAchievements();
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);

  // Sort achievements by rarity and unlock status
  const sortedAchievements = [...achievements].sort((a, b) => {
    const aUnlocked = isUnlocked(a.id);
    const bUnlocked = isUnlocked(b.id);
    
    if (aUnlocked && !bUnlocked) return -1;
    if (!aUnlocked && bUnlocked) return 1;
    
    return getRarityOrder(b.rarity) - getRarityOrder(a.rarity);
  });

  const displayAchievements = showAll 
    ? sortedAchievements 
    : sortedAchievements.slice(0, 6);

  const unlockedCount = unlockedAchievements.length;
  const totalCount = achievements.length;
  const progressPercentage = (unlockedCount / totalCount) * 100;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <h3 className="text-lg font-semibold">{t("achievementsTitle")}</h3>
        </div>
        <div className="text-sm text-muted-foreground">
          {t("unlockedOf", { count: unlockedCount, total: totalCount })}
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Achievement Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {displayAchievements.map((achievement) => {
          const isUnlockedAchievement = isUnlocked(achievement.id);
          const currentProgress = progress[achievement.requirement.type] || 0;
          const progressValue = Math.min(currentProgress, achievement.requirement.value);
          const isProgressAchievement = achievement.requirement.type === 'levels_completed' || 
                                     achievement.requirement.type === 'perfect_levels' ||
                                     achievement.requirement.type === 'no_hints_used';

          return (
            <Card 
              key={achievement.id}
              className={`relative overflow-hidden transition-all duration-300 ${
                isUnlockedAchievement 
                  ? 'bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/30' 
                  : 'bg-background/50 border-border opacity-75'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">
                    {isUnlockedAchievement ? achievement.icon : '🔒'}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-medium text-sm truncate ${
                        isUnlockedAchievement ? 'text-yellow-400' : 'text-muted-foreground'
                      }`}>
                        {content.achievement(achievement).name}
                      </h4>
                      {isUnlockedAchievement && (
                        <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {content.achievement(achievement).description}
                    </p>
                    
                    {/* Progress Bar */}
                    {isProgressAchievement && !isUnlockedAchievement && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{content.progress()}</span>
                          <span>{progressValue}/{achievement.requirement.value}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div 
                            className="bg-primary h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${(progressValue / achievement.requirement.value) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <Badge 
                        variant="outline" 
                        className="text-xs"
                        style={{ 
                          borderColor: getRarityColor(achievement.rarity), 
                          color: isUnlockedAchievement ? getRarityColor(achievement.rarity) : '#64748b'
                        }}
                      >
                        {content.rarity(achievement.rarity)}
                      </Badge>
                      
                      <div className="text-xs text-muted-foreground text-right">
                        <div className="truncate max-w-[100px]">
                          {content.achievement(achievement).reward}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Show More Button */}
      {achievements.length > 6 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAll(!showAll)}
          className="w-full"
        >
          {showAll ? t("showLess") : t("showAll", { count: achievements.length })}
        </Button>
      )}
    </div>
  );
}
