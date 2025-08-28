"use client";

import { Doughnut } from "react-chartjs-2";
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    ChartOptions,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

type DonutChartProps = {
    attendees: number;
    volunteers: number;
};

export default function DonutChart({ attendees, volunteers }: DonutChartProps) {
    const data = {
        labels: ["Attendees", "Volunteers"],
        datasets: [
            {
                data: [attendees, volunteers],
                backgroundColor: ["#3B82F6", "#10B981"],
                borderColor: ["#fff", "#fff"],
                borderWidth: 4,
            },
        ],
    };

    const options: ChartOptions<"doughnut"> = {
        cutout: "60%",
        plugins: {
            legend: {
                position: "left",
            },
        },
        responsive: true,
        maintainAspectRatio: false,
    };

    return (
        <div className="h-32 w-full">
            <Doughnut data={data} options={options} />
        </div>
    );
}
