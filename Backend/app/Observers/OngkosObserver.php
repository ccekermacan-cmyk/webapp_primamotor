<?php

namespace App\Observers;

use App\Models\Ongkos;
use App\Models\Report;
use Illuminate\Support\Facades\DB;

class OngkosObserver
{
    private function getDateString(Ongkos $ongkos): string
    {
        if ($ongkos->created_at) {
            return substr((string) $ongkos->created_at, 0, 10);
        }
        if ($ongkos->date) {
            return substr((string) $ongkos->date, 0, 10);
        }
        return '';
    }

    private function getOrCreateReport(string $tanggal): ?Report
    {
        if (!$tanggal) return null;
        $rep = Report::whereDate('created_at', $tanggal)->first();
        if (!$rep) {
            try {
                $rep = Report::create(['created_at' => $tanggal . ' 08:00:00']);
            } catch (\Exception $e) {
                $rep = Report::whereDate('created_at', $tanggal)->first();
            }
        }
        return $rep;
    }

    public function created(Ongkos $ongkos): void
    {
        $val = (float) $ongkos->ongkos;
        $tanggal = $this->getDateString($ongkos);

        if (!$tanggal || $val == 0) return;

        $report = $this->getOrCreateReport($tanggal);
        if ($report) {
            if ($val > 0) {
                DB::table('report')->where('id', $report->id)->increment('omset_servis', $val);
            } elseif ($val < 0) {
                DB::table('report')->where('id', $report->id)->decrement('omset_servis', abs($val));
            }
        }
    }

    public function updated(Ongkos $ongkos): void
    {
        $oldVal = (float) ($ongkos->getOriginal('ongkos') ?? 0);
        $oldCreated = $ongkos->getOriginal('created_at') ?? $ongkos->getOriginal('date');
        $oldTanggal = $oldCreated ? substr((string) $oldCreated, 0, 10) : '';

        $newVal = (float) $ongkos->ongkos;
        $newTanggal = $this->getDateString($ongkos);

        // Revert old value
        if ($oldTanggal && $oldVal != 0) {
            $oldReport = $this->getOrCreateReport($oldTanggal);
            if ($oldReport) {
                if ($oldVal > 0) {
                    DB::table('report')->where('id', $oldReport->id)->decrement('omset_servis', $oldVal);
                } elseif ($oldVal < 0) {
                    DB::table('report')->where('id', $oldReport->id)->increment('omset_servis', abs($oldVal));
                }
            }
        }

        // Apply new value
        if ($newTanggal && $newVal != 0) {
            $newReport = $this->getOrCreateReport($newTanggal);
            if ($newReport) {
                if ($newVal > 0) {
                    DB::table('report')->where('id', $newReport->id)->increment('omset_servis', $newVal);
                } elseif ($newVal < 0) {
                    DB::table('report')->where('id', $newReport->id)->decrement('omset_servis', abs($newVal));
                }
            }
        }
    }

    public function deleted(Ongkos $ongkos): void
    {
        $val = (float) $ongkos->ongkos;
        $tanggal = $this->getDateString($ongkos);

        if (!$tanggal || $val == 0) return;

        $report = $this->getOrCreateReport($tanggal);
        if ($report) {
            if ($val > 0) {
                DB::table('report')->where('id', $report->id)->decrement('omset_servis', $val);
            } elseif ($val < 0) {
                DB::table('report')->where('id', $report->id)->increment('omset_servis', abs($val));
            }
        }
    }
}
