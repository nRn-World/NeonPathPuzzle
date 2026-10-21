import { content } from "@/lib/contentText";
import { useEffect } from 'react';
import { usePowerUps } from '@/hooks/use-powerups';
import { powerUps, getRarityColor } from '@/lib/powerups';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Package } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export function PowerUpInventory() {
  const { inventory, activeEffects, usePowerUp, removeEffect } = usePowerUps();
  const { t } = useI18n();

  // Expired effects are pruned after render; checking them during render used
  // to mutate the store from inside the component and could warn in React.
  useEffect(() => {
    const now = Date.now();
    activeEffects.forEach(effect => {
      if (effect.endTime && effect.endTime <= now) removeEffect(effect.type);
    });
  }, [activeEffects, removeEffect]);

  const now = Date.now();
  const visibleEffects = activeEffects.filter(effect => !effect.endTime || effect.endTime > now);
  const activeTypes = new Set(visibleEffects.map(effect => effect.type));

  if (inventory.length === 0 && visibleEffects.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>{t("noPowerUps")}</p>
        <p className="text-sm">{t("noPowerUpsDesc")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active Effects */}
      {visibleEffects.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-green-400 mb-2">{t("activeEffects")}</h3>
          <div className="grid grid-cols-2 gap-2">
            {visibleEffects.map((effect, idx) => {
              const powerUp = powerUps.find(pu => pu.effect.type === effect.type);
              if (!powerUp) return null;
              
              return (
                <div key={idx} className="bg-green-500/10 border border-green-500/30 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{powerUp.icon}</span>
                    <div className="flex-1">
                      <div className="text-xs font-medium">{content.powerUp(powerUp).name}</div>
                      <div className="text-xs text-green-400">{t("activeLabel")}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Power-ups */}
      {inventory.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">{t("availablePowerUps")}</h3>
          <div className="grid grid-cols-2 gap-2">
            {inventory.map((powerUp, idx) => {
              const isActive = activeTypes.has(powerUp.effect.type);
              
              return (
                <Card key={idx} className="bg-background/50 border-border">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{powerUp.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{content.powerUp(powerUp).name}</div>
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                          style={{ borderColor: getRarityColor(powerUp.rarity), color: getRarityColor(powerUp.rarity) }}
                        >
                          {content.rarity(powerUp.rarity)}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {content.powerUp(powerUp).description}
                    </p>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={isActive}
                      onClick={() => usePowerUp(powerUp.id)}
                    >
                      <Zap className="w-3 h-3 mr-1" />
                      {isActive ? t("activeLabel") : t("useLabel")}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
