import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../ui/components/ui/popover';
import { Calendar as CalendarComponent } from '../../../../ui/components/ui/calendar';
import { addDays, format } from 'date-fns';
import { cn } from '../../../../client/lib/utils';
import { DateRange } from 'react-day-picker';

interface DateRangePickerProps {
  start: Date;
  end: Date;
  onRangeChange: (start: Date, end: Date) => void;
  className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  start,
  end,
  onRangeChange,
  className
}) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>({
    from: start,
    to: end
  });

  const handleSelect = (range: DateRange | undefined) => {
    setDate(range);
    if (range?.from && range?.to) {
      onRangeChange(range.from, range.to);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[280px] justify-start text-left font-normal',
            !date && 'text-muted-foreground',
            className
          )}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {date?.from ? (
            date.to ? (
              <>
                {format(date.from, 'LLL dd, y')} -{' '}
                {format(date.to, 'LLL dd, y')}
              </>
            ) : (
              format(date.from, 'LLL dd, y')
            )
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarComponent
          initialFocus
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={handleSelect}
          numberOfMonths={2}
        />
        <div className="p-3 border-t flex justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const today = new Date();
              const weekAgo = addDays(today, -7);
              handleSelect({ from: weekAgo, to: today });
            }}
          >
            Last 7 days
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const today = new Date();
              const monthAgo = addDays(today, -30);
              handleSelect({ from: monthAgo, to: today });
            }}
          >
            Last 30 days
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};