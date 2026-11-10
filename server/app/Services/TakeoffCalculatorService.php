<?php

namespace App\Services;

class TakeoffCalculatorService
{
    /**
     * Compute raw and scaled quantity based on measurement type, geometry, and scale.
     *
     * @param string $type rect | line | polygon | count | volume
     * @param array $geometry e.g. [{x,y}, {x,y}] or {x, y, width, height}
     * @param float $pixelsPerUnit
     * @param float|null $depth Real-world depth for volume calculation
     * @return array [raw_quantity, computed_quantity]
     */
    public static function calculateQuantity(string $type, array $geometry, float $pixelsPerUnit = 1.0, ?float $depth = null): array
    {
        $ppu = ($pixelsPerUnit > 0) ? $pixelsPerUnit : 1.0;
        $ppu2 = $ppu * $ppu;

        switch ($type) {
            case 'rect':
                // Geometry can be {x, y, width, height} or 2 points [{x,y}, {x,y}]
                $w = 0.0;
                $h = 0.0;
                if (isset($geometry['width']) && isset($geometry['height'])) {
                    $w = abs((float)$geometry['width']);
                    $h = abs((float)$geometry['height']);
                } elseif (isset($geometry[0]) && isset($geometry[1])) {
                    $w = abs((float)$geometry[1]['x'] - (float)$geometry[0]['x']);
                    $h = abs((float)$geometry[1]['y'] - (float)$geometry[0]['y']);
                }
                $rawArea = $w * $h; // pixels^2
                $computed = $rawArea / $ppu2; // real units^2
                return [
                    'raw_quantity' => round($rawArea, 4),
                    'computed_quantity' => round($computed, 4)
                ];

            case 'line':
                // Geometry is an array of points [{x, y}, {x, y}, ...]
                $totalPx = 0.0;
                $pts = isset($geometry['points']) ? $geometry['points'] : $geometry;
                if (is_array($pts) && count($pts) >= 2) {
                    for ($i = 0; $i < count($pts) - 1; $i++) {
                        $p1 = $pts[$i];
                        $p2 = $pts[$i + 1];
                        $dx = (float)$p2['x'] - (float)$p1['x'];
                        $dy = (float)$p2['y'] - (float)$p1['y'];
                        $totalPx += sqrt(($dx * $dx) + ($dy * $dy));
                    }
                }
                $computed = $totalPx / $ppu;
                return [
                    'raw_quantity' => round($totalPx, 4),
                    'computed_quantity' => round($computed, 4)
                ];

            case 'polygon':
                $pts = isset($geometry['points']) ? $geometry['points'] : $geometry;
                $rawArea = self::shoelaceArea($pts);
                $computed = $rawArea / $ppu2;
                return [
                    'raw_quantity' => round($rawArea, 4),
                    'computed_quantity' => round($computed, 4)
                ];

            case 'volume':
                $pts = isset($geometry['points']) ? $geometry['points'] : $geometry;
                $rawArea = self::shoelaceArea($pts);
                $areaScaled = $rawArea / $ppu2;
                $realDepth = ($depth !== null && $depth > 0) ? (float)$depth : 1.0;
                $computed = $areaScaled * $realDepth;
                return [
                    'raw_quantity' => round($rawArea, 4),
                    'computed_quantity' => round($computed, 4)
                ];

            case 'count':
                // Count can be array of pin points [{x, y}, ...]
                $pts = isset($geometry['points']) ? $geometry['points'] : $geometry;
                $count = is_array($pts) ? count($pts) : 1;
                if ($count <= 0) $count = 1;
                return [
                    'raw_quantity' => (float)$count,
                    'computed_quantity' => (float)$count
                ];

            default:
                return [
                    'raw_quantity' => 0.0,
                    'computed_quantity' => 0.0
                ];
        }
    }

    /**
     * Compute polygon area in pixels via Shoelace Formula
     */
    public static function shoelaceArea(array $pts): float
    {
        $n = count($pts);
        if ($n < 3) {
            return 0.0;
        }

        $sum1 = 0.0;
        $sum2 = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $j = ($i + 1) % $n;
            $x1 = (float)$pts[$i]['x'];
            $y1 = (float)$pts[$i]['y'];
            $x2 = (float)$pts[$j]['x'];
            $y2 = (float)$pts[$j]['y'];

            $sum1 += ($x1 * $y2);
            $sum2 += ($y1 * $x2);
        }

        return abs($sum1 - $sum2) * 0.5;
    }

    /**
     * Calibrate scale from two screen points and known real distance
     */
    public static function calibrateScale(array $pointA, array $pointB, float $realDistance): float
    {
        if ($realDistance <= 0) {
            return 1.0;
        }

        $dx = (float)$pointB['x'] - (float)$pointA['x'];
        $dy = (float)$pointB['y'] - (float)$pointA['y'];
        $pixelDistance = sqrt(($dx * $dx) + ($dy * $dy));

        if ($pixelDistance <= 0) {
            return 1.0;
        }

        return round($pixelDistance / $realDistance, 4);
    }

    /**
     * Calculate line item financial total including waste factor and labor
     */
    public static function calculateLineTotal(float $computedQty, float $unitCost, float $wasteFactorPercent = 0.0, float $laborRate = 0.0): float
    {
        $wasteMultiplier = 1.0 + (max(0.0, $wasteFactorPercent) / 100.0);
        $materialCost = $computedQty * $unitCost * $wasteMultiplier;
        return round($materialCost + $laborRate, 2);
    }
}

